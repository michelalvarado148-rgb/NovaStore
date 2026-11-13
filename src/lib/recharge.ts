import { getDb, nowIso } from './db';
import { adjustBalance } from './orders';

export type RechargeStatus = 'pendiente' | 'aprobado' | 'rechazado';

/** Monto mínimo y máximo aceptado en una solicitud de recarga (en centavos). */
export const RECHARGE_MIN_CENTS = 500;
export const RECHARGE_MAX_CENTS = 200000;
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export type RechargeRow = {
  id: number;
  user_id: number;
  amount_cents: number;
  method: string;
  reference: string | null;
  note: string | null;
  status: RechargeStatus;
  admin_note: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  has_proof: number;
  created_at: string;
  reviewed_at: string | null;
};

export type RechargeWithUser = RechargeRow & { user_name: string; user_email: string };

export type RechargeResult = { ok: true; id: number } | { ok: false; error: string };
export type RechargeReviewResult = { ok: true } | { ok: false; error: string };

const COLS = `id, user_id, amount_cents, method, reference, note, status, admin_note,
  file_name, mime_type, size_bytes, (data IS NOT NULL) AS has_proof, created_at, reviewed_at`;

export type RechargeMethod = {
  code: string;
  name: string;
  account_info: string;
  instructions: string;
};

/** Métodos con los que el cliente puede recargar saldo (el propio saldo queda fuera). */
export function getRechargeMethods(): RechargeMethod[] {
  return getDb()
    .prepare(
      `SELECT code, name, account_info, instructions FROM payment_methods
        WHERE is_enabled = 1 AND code <> 'saldo'
        ORDER BY position, id`,
    )
    .all() as RechargeMethod[];
}

export function getMyRecharges(userId: number, limit = 50): RechargeRow[] {
  return getDb()
    .prepare(`SELECT ${COLS} FROM recharge_requests WHERE user_id = ? ORDER BY id DESC LIMIT ?`)
    .all(userId, limit) as RechargeRow[];
}

export function getAllRecharges(status?: RechargeStatus | 'todas'): RechargeWithUser[] {
  const db = getDb();
  const where = status && status !== 'todas' ? 'WHERE r.status = ?' : '';
  const sql = `SELECT r.id, r.user_id, r.amount_cents, r.method, r.reference, r.note, r.status,
                      r.admin_note, r.file_name, r.mime_type, r.size_bytes,
                      (r.data IS NOT NULL) AS has_proof, r.created_at, r.reviewed_at,
                      u.name AS user_name, u.email AS user_email
                 FROM recharge_requests r
                 JOIN users u ON u.id = r.user_id
                 ${where}
                ORDER BY r.status = 'pendiente' DESC, r.id DESC
                LIMIT 200`;
  const statement = db.prepare(sql);
  return (status && status !== 'todas' ? statement.all(status) : statement.all()) as RechargeWithUser[];
}

export function countPendingRecharges(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM recharge_requests WHERE status = 'pendiente'")
    .get() as { total: number };
  return row.total;
}

/**
 * Crea una solicitud de recarga. El saldo NO se acredita aquí: queda pendiente
 * hasta que el administrador verifique el comprobante.
 */
export async function createRechargeRequest(input: {
  userId: number;
  amountCents: number;
  method: string;
  reference: string;
  note: string;
  file: File | null;
}): Promise<RechargeResult> {
  const db = getDb();
  const amount = Math.round(input.amountCents);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Ingresa el monto que deseas recargar.' };
  }
  if (amount < RECHARGE_MIN_CENTS) {
    return {
      ok: false,
      error: `El monto mínimo de recarga es S/ ${(RECHARGE_MIN_CENTS / 100).toFixed(2)}.`,
    };
  }
  if (amount > RECHARGE_MAX_CENTS) {
    return {
      ok: false,
      error: `El monto máximo por solicitud es S/ ${(RECHARGE_MAX_CENTS / 100).toFixed(2)}.`,
    };
  }

  const methodCode = input.method.trim();
  const method = db
    .prepare('SELECT code, name FROM payment_methods WHERE code = ? AND is_enabled = 1')
    .get(methodCode) as { code: string; name: string } | undefined;
  if (!method) return { ok: false, error: 'Selecciona un método de pago disponible.' };
  if (method.code === 'saldo') {
    return { ok: false, error: 'No puedes recargar saldo usando el propio saldo.' };
  }

  if (!input.file || input.file.size === 0) {
    return { ok: false, error: 'Adjunta la imagen o PDF de tu comprobante de pago.' };
  }
  if (input.file.size > MAX_PROOF_BYTES) {
    return { ok: false, error: 'El comprobante no debe superar los 5 MB.' };
  }
  const mime = input.file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.includes(mime)) {
    return { ok: false, error: 'Formato no permitido. Sube una imagen JPG, PNG, WEBP o un PDF.' };
  }

  const reference = input.reference.trim().slice(0, 120) || null;
  const note = input.note.trim().slice(0, 500) || null;

  // Evita registros duplicados: misma operación o doble envío seguido.
  if (reference) {
    const duplicate = db
      .prepare(
        "SELECT id FROM recharge_requests WHERE user_id = ? AND reference = ? AND status = 'pendiente'",
      )
      .get(input.userId, reference) as { id: number } | undefined;
    if (duplicate) {
      return {
        ok: false,
        error: 'Ya tienes una solicitud pendiente con ese número de operación.',
      };
    }
  }
  const recentWindow = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const recent = db
    .prepare(
      `SELECT id FROM recharge_requests
        WHERE user_id = ? AND amount_cents = ? AND status = 'pendiente' AND created_at > ?`,
    )
    .get(input.userId, amount, recentWindow) as { id: number } | undefined;
  if (recent) {
    return {
      ok: false,
      error: 'Tu solicitud anterior sigue en revisión. Espera la respuesta del administrador.',
    };
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const info = db
    .prepare(
      `INSERT INTO recharge_requests
        (user_id, amount_cents, method, reference, note, status, file_name, mime_type, size_bytes, data, created_at)
       VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?, ?)`,
    )
    .run(
      input.userId,
      amount,
      method.code,
      reference,
      note,
      input.file.name.slice(0, 160) || null,
      mime,
      buffer.length,
      buffer,
      nowIso(),
    );

  return { ok: true, id: Number(info.lastInsertRowid) };
}

/**
 * Aprueba o rechaza una solicitud. Aprobar acredita el saldo una sola vez:
 * la actualización exige que el estado siga siendo 'pendiente'.
 */
export function reviewRechargeRequest(input: {
  id: number;
  action: 'aprobar' | 'rechazar';
  adminId: number;
  adminNote: string;
}): RechargeReviewResult {
  const db = getDb();
  const adminNote = input.adminNote.trim().slice(0, 500) || null;

  const run = db.transaction((): RechargeReviewResult => {
    const row = db
      .prepare('SELECT id, user_id, amount_cents, status FROM recharge_requests WHERE id = ?')
      .get(input.id) as
      | { id: number; user_id: number; amount_cents: number; status: RechargeStatus }
      | undefined;
    if (!row) return { ok: false, error: 'Solicitud no encontrada.' };
    if (row.status !== 'pendiente') {
      return { ok: false, error: 'Esta solicitud ya fue revisada.' };
    }

    const status: RechargeStatus = input.action === 'aprobar' ? 'aprobado' : 'rechazado';
    const info = db
      .prepare(
        `UPDATE recharge_requests
            SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ?
          WHERE id = ? AND status = 'pendiente'`,
      )
      .run(status, adminNote, input.adminId, nowIso(), input.id);

    if (info.changes === 0) {
      return { ok: false, error: 'Esta solicitud ya fue revisada.' };
    }

    if (status === 'aprobado') {
      const credit = adjustBalance({
        userId: row.user_id,
        amountCents: row.amount_cents,
        type: 'recarga',
        description: `Recarga aprobada (solicitud #${row.id})`,
        adminId: input.adminId,
      });
      if (!credit.ok) throw new Error(credit.error);
    }

    return { ok: true };
  });

  try {
    return run();
  } catch {
    return { ok: false, error: 'No se pudo acreditar el saldo. Inténtalo nuevamente.' };
  }
}

/** Comprobante para descarga: solo su dueño o un administrador. */
export function getRechargeProof(
  id: number,
  viewer: { id: number; role: string },
): { file_name: string | null; mime_type: string; data: Buffer } | null {
  const row = getDb()
    .prepare(
      'SELECT user_id, file_name, mime_type, data FROM recharge_requests WHERE id = ? AND data IS NOT NULL',
    )
    .get(id) as
    | { user_id: number; file_name: string | null; mime_type: string | null; data: Buffer }
    | undefined;
  if (!row) return null;
  if (viewer.role !== 'admin' && row.user_id !== viewer.id) return null;
  return {
    file_name: row.file_name,
    mime_type: row.mime_type || 'application/octet-stream',
    data: row.data,
  };
}
