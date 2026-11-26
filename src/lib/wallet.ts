/**
 * NovaWallet: alcancía digital independiente de NOVASTORE.
 *
 * El dinero, los movimientos y las solicitudes de NovaWallet viven en la tabla
 * `settings` con el prefijo `wallet:`. Esa tabla ya se replica en Supabase (ver
 * persistence.ts), así que los datos son permanentes y sobreviven a reinicios,
 * cierres de sesión y despliegues sin crear tablas nuevas en el proyecto
 * conectado (la conexión de la tienda no tiene permisos de DDL).
 *
 * Nada de esto toca `users.balance_cents` ni `balance_movements`: el saldo de la
 * tienda y el de la alcancía son independientes por diseño. NovaWallet tampoco
 * se puede usar para comprar productos de NOVASTORE.
 */
import { getDb, nowIso } from './db';
import { isAllowedPaymentQrUrl } from './payment-qr';

export type WalletRequestKind = 'recarga' | 'retiro';
export type WalletRequestStatus = 'pendiente' | 'aprobado' | 'rechazado';

export const WALLET_DEFAULT_MIN_RECHARGE_CENTS = 500;
export const WALLET_DEFAULT_MIN_WITHDRAW_CENTS = 500;
export const WALLET_MAX_NOTE = 300;
export const WALLET_MAX_REFERENCE = 60;
export const WALLET_MAX_PERCENT = 50;

const CFG_KEY = 'wallet:cfg';
const SEQ_PREFIX = 'wallet:seq:';
const ACCT_PREFIX = 'wallet:acct:';
const REQ_PREFIX = 'wallet:req:';
const TX_PREFIX = 'wallet:tx:';

export type WalletConfig = {
  /** Número de Yape del administrador al que los clientes envían el dinero. */
  yape_number: string;
  yape_holder: string;
  /**
   * URL del QR de pago que ven los clientes al agregar dinero. Se sube desde el
   * panel con el módulo de medios (Supabase Storage o /api/media/<id>).
   */
  qr_url: string;
  /** Aviso libre que se muestra arriba de la alcancía (p. ej. comisiones). */
  notice: string;
  fee_enabled: boolean;
  /** Comisión de retiro: porcentaje sobre el monto solicitado. */
  fee_percent: number;
  /** Comisión de retiro: monto fijo adicional, en centavos. */
  fee_fixed_cents: number;
  min_recharge_cents: number;
  min_withdraw_cents: number;
};

const DEFAULT_CONFIG: WalletConfig = {
  yape_number: '',
  yape_holder: '',
  qr_url: '',
  notice: '',
  fee_enabled: false,
  fee_percent: 0,
  fee_fixed_cents: 0,
  min_recharge_cents: WALLET_DEFAULT_MIN_RECHARGE_CENTS,
  min_withdraw_cents: WALLET_DEFAULT_MIN_WITHDRAW_CENTS,
};

export type WalletAccount = {
  user_id: number;
  balance_cents: number;
  created_at: string;
  updated_at: string;
};

export type WalletRequest = {
  id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  kind: WalletRequestKind;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  method: string;
  reference: string | null;
  note: string | null;
  proof_url: string | null;
  proof_name: string | null;
  status: WalletRequestStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type WalletMovement = {
  id: number;
  user_id: number;
  kind: 'ingreso' | 'retiro';
  amount_cents: number;
  description: string;
  request_id: number | null;
  created_at: string;
};

export type WalletResult = { ok: true; id: number } | { ok: false; error: string };
export type WalletConfigResult = { ok: true; config: WalletConfig } | { ok: false; error: string };
export type WalletReviewResult = { ok: true } | { ok: false; error: string };

/* ----------------------------- Utilidades ----------------------------- */

function readJson<T>(key: string): T | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(value), nowIso());
}

function readByPrefix<T>(prefix: string): T[] {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings WHERE key LIKE ?')
    .all(`${prefix}%`) as { key: string; value: string }[];
  const out: T[] = [];
  for (const row of rows) {
    try {
      out.push(JSON.parse(row.value) as T);
    } catch {
      // Una entrada corrupta no debe romper la alcancía.
    }
  }
  return out;
}

function nextId(kind: 'req' | 'tx'): number {
  const db = getDb();
  const key = `${SEQ_PREFIX}${kind}`;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  const next = (Number(row?.value ?? 0) || 0) + 1;
  writeJson(key, next);
  return next;
}

function toCents(value: unknown, fallback = 0): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------ Ajustes ------------------------------- */

export function getWalletConfig(): WalletConfig {
  const raw = readJson<Partial<WalletConfig>>(CFG_KEY);
  if (!raw) return { ...DEFAULT_CONFIG };
  return {
    yape_number: typeof raw.yape_number === 'string' ? raw.yape_number.trim().slice(0, 40) : '',
    yape_holder: typeof raw.yape_holder === 'string' ? raw.yape_holder.trim().slice(0, 80) : '',
    qr_url:
      typeof raw.qr_url === 'string' && isAllowedPaymentQrUrl(raw.qr_url)
        ? raw.qr_url.trim()
        : '',
    notice: typeof raw.notice === 'string' ? raw.notice.trim().slice(0, 600) : '',
    fee_enabled: raw.fee_enabled === true,
    fee_percent: clamp(toCents(raw.fee_percent, 0), 0, WALLET_MAX_PERCENT),
    fee_fixed_cents: Math.max(0, toCents(raw.fee_fixed_cents, 0)),
    min_recharge_cents: Math.max(
      100,
      toCents(raw.min_recharge_cents, WALLET_DEFAULT_MIN_RECHARGE_CENTS),
    ),
    min_withdraw_cents: Math.max(
      100,
      toCents(raw.min_withdraw_cents, WALLET_DEFAULT_MIN_WITHDRAW_CENTS),
    ),
  };
}

export function saveWalletConfig(input: {
  yapeNumber: string;
  yapeHolder: string;
  notice: string;
  feeEnabled: boolean;
  feePercent: string | number;
  feeFixedCents: string | number;
  minRechargeCents: string | number;
  minWithdrawCents: string | number;
}): WalletConfigResult {
  const feePercent = clamp(toCents(input.feePercent, 0), 0, WALLET_MAX_PERCENT);
  const feeFixedCents = Math.max(0, toCents(input.feeFixedCents, 0));
  if (input.feeEnabled && feePercent === 0 && feeFixedCents === 0) {
    return {
      ok: false,
      error: 'Para activar la comisión define un porcentaje o un monto fijo mayor a 0.',
    };
  }

  const minRecharge = Math.max(100, toCents(input.minRechargeCents, WALLET_DEFAULT_MIN_RECHARGE_CENTS));
  const minWithdraw = Math.max(100, toCents(input.minWithdrawCents, WALLET_DEFAULT_MIN_WITHDRAW_CENTS));

  // El QR se administra en su propia sección: guardar el resto de ajustes no lo borra.
  const current = getWalletConfig();

  const config: WalletConfig = {
    yape_number: input.yapeNumber.trim().slice(0, 40),
    yape_holder: input.yapeHolder.trim().slice(0, 80),
    qr_url: current.qr_url,
    notice: input.notice.trim().slice(0, 600),
    fee_enabled: Boolean(input.feeEnabled),
    fee_percent: feePercent,
    fee_fixed_cents: feeFixedCents,
    min_recharge_cents: minRecharge,
    min_withdraw_cents: minWithdraw,
  };

  writeJson(CFG_KEY, config);
  return { ok: true, config };
}

export type WalletQrResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Guarda (o reemplaza) el QR de pago de la alcancía. Solo acepta imágenes
 * subidas desde el panel: Supabase Storage o /api/media/<id>. Así una URL
 * externa o un SVG no pueden ocupar el lugar del QR.
 */
export function setWalletQrUrl(raw: string): WalletQrResult {
  const url = raw.trim();
  if (!url) {
    return { ok: false, error: 'Sube la imagen del QR antes de guardar.' };
  }
  if (!isAllowedPaymentQrUrl(url)) {
    return {
      ok: false,
      error: 'La imagen del QR debe ser un archivo JPG, PNG o WEBP subido desde este panel.',
    };
  }

  const config = getWalletConfig();
  writeJson(CFG_KEY, { ...config, qr_url: url });
  return { ok: true, url };
}

/** Quita el QR: los clientes vuelven a ver el aviso de que no está disponible. */
export function clearWalletQrUrl(): void {
  const config = getWalletConfig();
  writeJson(CFG_KEY, { ...config, qr_url: '' });
}

/** Comisión que se descuenta del monto retirado (nunca supera el monto). */
export function walletFeeCents(config: WalletConfig, amountCents: number): number {
  const amount = Math.max(0, Math.round(amountCents));
  if (!config.fee_enabled || amount === 0) return 0;
  const fee = Math.round((amount * config.fee_percent) / 100) + config.fee_fixed_cents;
  return Math.max(0, Math.min(fee, amount - 1));
}

/* ------------------------------- Cuenta ------------------------------- */

export function getWalletAccount(userId: number): WalletAccount {
  const stored = readJson<WalletAccount>(`${ACCT_PREFIX}${userId}`);
  if (stored && Number.isFinite(Number(stored.balance_cents))) {
    return {
      user_id: userId,
      balance_cents: Math.max(0, Math.round(Number(stored.balance_cents))),
      created_at: typeof stored.created_at === 'string' ? stored.created_at : '',
      updated_at: typeof stored.updated_at === 'string' ? stored.updated_at : '',
    };
  }
  return { user_id: userId, balance_cents: 0, created_at: '', updated_at: '' };
}

export function getWalletBalance(userId: number): number {
  return getWalletAccount(userId).balance_cents;
}

function setWalletBalance(userId: number, balanceCents: number): void {
  const account = getWalletAccount(userId);
  writeJson(`${ACCT_PREFIX}${userId}`, {
    user_id: userId,
    balance_cents: Math.max(0, Math.round(balanceCents)),
    created_at: account.created_at || nowIso(),
    updated_at: nowIso(),
  });
}

function addMovement(input: {
  userId: number;
  kind: 'ingreso' | 'retiro';
  amountCents: number;
  description: string;
  requestId: number | null;
}): void {
  const id = nextId('tx');
  writeJson(`${TX_PREFIX}${id}`, {
    id,
    user_id: input.userId,
    kind: input.kind,
    amount_cents: Math.round(input.amountCents),
    description: input.description.slice(0, 200),
    request_id: input.requestId,
    created_at: nowIso(),
  } satisfies WalletMovement);
}

/* ---------------------------- Solicitudes ----------------------------- */

function normalizeRequest(raw: WalletRequest): WalletRequest {
  return {
    ...raw,
    amount_cents: Math.max(0, toCents(raw.amount_cents, 0)),
    fee_cents: Math.max(0, toCents(raw.fee_cents, 0)),
    net_cents: Math.max(0, toCents(raw.net_cents, toCents(raw.amount_cents, 0))),
    status: raw.status === 'aprobado' || raw.status === 'rechazado' ? raw.status : 'pendiente',
  };
}

export function listWalletRequests(
  filter: { kind?: WalletRequestKind; status?: WalletRequestStatus | 'todas' } = {},
): WalletRequest[] {
  const requests = readByPrefix<WalletRequest>(REQ_PREFIX)
    .filter((row) => Number.isInteger(Number(row.id)) && Number(row.id) > 0)
    .map((row) => normalizeRequest({ ...row, id: Number(row.id), user_id: Number(row.user_id) }))
    .filter((row) => (filter.kind ? row.kind === filter.kind : true))
    .filter((row) =>
      !filter.status || filter.status === 'todas' ? true : row.status === filter.status,
    )
    .sort((a, b) => b.id - a.id);

  if (requests.length === 0) return requests;

  const ids = [...new Set(requests.map((row) => row.user_id))];
  const placeholders = ids.map(() => '?').join(', ');
  const users = getDb()
    .prepare(`SELECT id, name, email FROM users WHERE id IN (${placeholders})`)
    .all(...ids) as { id: number; name: string; email: string }[];
  const byId = new Map(users.map((user) => [user.id, user]));

  return requests.map((row) => ({
    ...row,
    user_name: byId.get(row.user_id)?.name ?? 'Cliente',
    user_email: byId.get(row.user_id)?.email ?? '',
  }));
}

export function getMyWalletRequests(userId: number, limit = 50): WalletRequest[] {
  return listWalletRequests({ status: 'todas' })
    .filter((row) => row.user_id === userId)
    .slice(0, limit);
}

export function countPendingWalletRequests(kind?: WalletRequestKind): number {
  return listWalletRequests({ kind, status: 'pendiente' }).length;
}

export function listWalletMovements(userId: number, limit = 200): WalletMovement[] {
  return readByPrefix<WalletMovement>(TX_PREFIX)
    .filter((row) => Number(row.user_id) === userId && Number.isInteger(Number(row.id)))
    .map((row) => ({
      ...row,
      id: Number(row.id),
      user_id: Number(row.user_id),
      amount_cents: toCents(row.amount_cents, 0),
    }))
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

/** Movimientos de todos los clientes (panel administrativo). */
export function listAllWalletMovements(limit = 200): (WalletMovement & { user_name: string })[] {
  const movements = readByPrefix<WalletMovement>(TX_PREFIX)
    .filter((row) => Number.isInteger(Number(row.id)))
    .map((row) => ({
      ...row,
      id: Number(row.id),
      user_id: Number(row.user_id),
      amount_cents: toCents(row.amount_cents, 0),
    }))
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);

  if (movements.length === 0) return [];
  const ids = [...new Set(movements.map((row) => row.user_id))];
  const placeholders = ids.map(() => '?').join(', ');
  const users = getDb()
    .prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`)
    .all(...ids) as { id: number; name: string }[];
  const byId = new Map(users.map((user) => [user.id, user.name]));
  return movements.map((row) => ({ ...row, user_name: byId.get(row.user_id) ?? 'Cliente' }));
}

/** Total acreditado en la alcancía de todos los clientes (resumen del panel). */
export function getWalletTotals(): { accounts: number; balance_cents: number; pending: number } {
  const accounts = readByPrefix<WalletAccount>(ACCT_PREFIX).filter((row) =>
    Number.isInteger(Number(row.user_id)),
  );
  return {
    accounts: accounts.length,
    balance_cents: accounts.reduce(
      (sum, row) => sum + Math.max(0, Math.round(Number(row.balance_cents) || 0)),
      0,
    ),
    pending: countPendingWalletRequests(),
  };
}

/* ------------------------- Crear solicitudes -------------------------- */

/**
 * Registra una recarga pendiente. El saldo NO se toca aquí: solo se acredita
 * cuando el administrador aprueba la solicitud y su comprobante.
 */
export function createWalletRecharge(input: {
  userId: number;
  amountCents: number;
  reference: string;
  note: string;
  proofUrl: string;
  proofName: string;
}): WalletResult {
  const config = getWalletConfig();
  const amount = toCents(input.amountCents, 0);

  if (amount <= 0) return { ok: false, error: 'Ingresa el monto que pagaste con el QR.' };
  if (amount < config.min_recharge_cents) {
    return {
      ok: false,
      error: `El monto mínimo para agregar a NovaWallet es S/ ${(config.min_recharge_cents / 100).toFixed(2)}.`,
    };
  }
  if (!input.proofUrl) {
    return { ok: false, error: 'Adjunta la imagen de tu comprobante de pago.' };
  }

  const reference = input.reference.trim().slice(0, WALLET_MAX_REFERENCE) || null;
  const note = input.note.trim().slice(0, WALLET_MAX_NOTE) || null;

  if (reference) {
    const duplicate = listWalletRequests({ kind: 'recarga', status: 'pendiente' }).find(
      (row) => row.user_id === input.userId && row.reference === reference,
    );
    if (duplicate) {
      return {
        ok: false,
        error: 'Ya tienes una recarga pendiente con ese número de operación.',
      };
    }
  }

  const recentWindow = Date.now() - 2 * 60 * 1000;
  const repeated = listWalletRequests({ kind: 'recarga', status: 'pendiente' }).find(
    (row) =>
      row.user_id === input.userId &&
      row.amount_cents === amount &&
      Date.parse(row.created_at) > recentWindow,
  );
  if (repeated) {
    return {
      ok: false,
      error: 'Tu solicitud anterior sigue en revisión. Espera la respuesta del administrador.',
    };
  }

  const id = nextId('req');
  const request: WalletRequest = {
    id,
    user_id: input.userId,
    kind: 'recarga',
    amount_cents: amount,
    fee_cents: 0,
    net_cents: amount,
    method: 'qr',
    reference,
    note,
    proof_url: input.proofUrl,
    proof_name: input.proofName.slice(0, 160) || null,
    status: 'pendiente',
    admin_note: null,
    created_at: nowIso(),
    reviewed_at: null,
  };
  writeJson(`${REQ_PREFIX}${id}`, request);
  return { ok: true, id };
}

/**
 * Registra una solicitud de retiro. Tampoco descuenta aquí: el saldo se
 * descuenta solo cuando el administrador la aprueba.
 */
export function createWalletWithdrawal(input: {
  userId: number;
  amountCents: number;
  method: string;
  note: string;
}): WalletResult {
  const config = getWalletConfig();
  const amount = toCents(input.amountCents, 0);

  if (amount <= 0) return { ok: false, error: 'Ingresa el monto que deseas retirar.' };
  if (amount < config.min_withdraw_cents) {
    return {
      ok: false,
      error: `El monto mínimo de retiro es S/ ${(config.min_withdraw_cents / 100).toFixed(2)}.`,
    };
  }

  const balance = getWalletBalance(input.userId);
  if (amount > balance) {
    return {
      ok: false,
      error: `No tienes saldo suficiente en NovaWallet. Tu saldo es S/ ${(balance / 100).toFixed(2)}.`,
    };
  }

  const fee = walletFeeCents(config, amount);
  const net = amount - fee;
  if (net <= 0) {
    return {
      ok: false,
      error: 'La comisión de retiro consume todo el monto. Solicita un monto mayor.',
    };
  }

  const method = input.method.trim().slice(0, 40) || 'Yape';
  const note = input.note.trim().slice(0, WALLET_MAX_NOTE) || null;

  const recentWindow = Date.now() - 2 * 60 * 1000;
  const repeated = listWalletRequests({ kind: 'retiro', status: 'pendiente' }).find(
    (row) =>
      row.user_id === input.userId &&
      row.amount_cents === amount &&
      Date.parse(row.created_at) > recentWindow,
  );
  if (repeated) {
    return { ok: false, error: 'Ya tienes un retiro pendiente por ese monto.' };
  }

  const id = nextId('req');
  const request: WalletRequest = {
    id,
    user_id: input.userId,
    kind: 'retiro',
    amount_cents: amount,
    fee_cents: fee,
    net_cents: net,
    method,
    reference: null,
    note,
    proof_url: null,
    proof_name: null,
    status: 'pendiente',
    admin_note: null,
    created_at: nowIso(),
    reviewed_at: null,
  };
  writeJson(`${REQ_PREFIX}${id}`, request);
  return { ok: true, id };
}

/* -------------------------- Revisión (admin) -------------------------- */

/**
 * Aprueba o rechaza una solicitud. El saldo se mueve solo al aprobar y dentro
 * de una transacción: la solicitud debe seguir pendiente, de modo que una doble
 * aprobación (o dos clics simultáneos) no puede acreditar ni descontar dos veces.
 */
export function reviewWalletRequest(input: {
  id: number;
  action: 'aprobar' | 'rechazar';
  adminId: number;
  adminNote: string;
}): WalletReviewResult {
  const db = getDb();
  const adminNote = input.adminNote.trim().slice(0, WALLET_MAX_NOTE) || null;

  const run = db.transaction((): WalletReviewResult => {
    const current = readJson<WalletRequest>(`${REQ_PREFIX}${input.id}`);
    if (!current) return { ok: false, error: 'Solicitud no encontrada.' };
    const request = normalizeRequest(current);
    if (request.status !== 'pendiente') {
      return { ok: false, error: 'Esta solicitud ya fue revisada.' };
    }

    const status: WalletRequestStatus = input.action === 'aprobar' ? 'aprobado' : 'rechazado';
    const reviewedAt = nowIso();

    if (status === 'aprobado') {
      const balance = getWalletBalance(request.user_id);
      if (request.kind === 'retiro') {
        if (balance < request.amount_cents) {
          return {
            ok: false,
            error: 'El cliente ya no tiene saldo suficiente en NovaWallet para este retiro.',
          };
        }
        setWalletBalance(request.user_id, balance - request.amount_cents);
        addMovement({
          userId: request.user_id,
          kind: 'retiro',
          amountCents: -request.amount_cents,
          description: `Retiro aprobado · solicitud #${request.id} · comisión S/ ${(
            request.fee_cents / 100
          ).toFixed(2)} · recibes S/ ${(request.net_cents / 100).toFixed(2)}`,
          requestId: request.id,
        });
      } else {
        setWalletBalance(request.user_id, balance + request.amount_cents);
        addMovement({
          userId: request.user_id,
          kind: 'ingreso',
          amountCents: request.amount_cents,
          description: `Recarga aprobada ${
            request.method === 'qr' ? 'por QR' : 'por Yape'
          } · solicitud #${request.id}`,
          requestId: request.id,
        });
      }
    }

    writeJson(`${REQ_PREFIX}${request.id}`, {
      ...request,
      user_name: undefined,
      user_email: undefined,
      status,
      admin_note: adminNote,
      reviewed_at: reviewedAt,
      reviewed_by: input.adminId,
    });

    return { ok: true };
  });

  try {
    return run();
  } catch {
    return { ok: false, error: 'No se pudo actualizar la solicitud. Inténtalo nuevamente.' };
  }
}
