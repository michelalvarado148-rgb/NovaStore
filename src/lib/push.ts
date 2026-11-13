import * as webpush from 'web-push';
import { getSetting, setSetting } from './catalog';
import { formatPEN } from './format';

/**
 * Notificaciones push del administrador (Web Push estándar, sin servicios de pago).
 *
 * Las claves VAPID y los dispositivos autorizados viven en la tabla `settings`,
 * que se sincroniza con Supabase: sobreviven a los despliegues y a los reinicios.
 * Las claves llevan el prefijo `push:` y `catalog.getSettings` las excluye para
 * que nunca se carguen en el escaparate ni en componentes de cliente.
 */
export const PUSH_ENABLED_KEY = 'push:enabled';
export const PUSH_VAPID_PUBLIC_KEY = 'push:vapid_public';
export const PUSH_VAPID_PRIVATE_KEY = 'push:vapid_private';
export const PUSH_SUBSCRIPTIONS_KEY = 'push:subscriptions';
export const PUSH_SENT_KEY = 'push:sent';
export const PUSH_LAST_SENT_KEY = 'push:last_sent';

/** Máximo de dispositivos autorizados (normalmente solo el teléfono del admin). */
export const MAX_PUSH_SUBSCRIPTIONS = 10;
/** Ventana de deduplicación: eventos recordados para no repetir avisos. */
const MAX_SENT_KEYS = 300;
const DEFAULT_SUBJECT = 'mailto:admin@novastore.pe';

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device: string;
  createdAt: string;
  lastSeenAt: string;
};

export type PushKind = 'pedido' | 'recarga' | 'comprobante' | 'prueba';

export type AdminPushEvent = {
  /** Clave única del evento: evita avisos duplicados (p. ej. `pedido:12`). */
  key: string;
  kind: PushKind;
  title: string;
  body: string;
  /** Ruta que se abre al tocar la notificación. */
  url: string;
  tag?: string;
};

export type PushSendResult = {
  ok: boolean;
  sent: number;
  failed: number;
  reason?: 'deshabilitado' | 'duplicado' | 'sin-dispositivos' | 'sin-claves';
};

export type PushDeviceSummary = { device: string; createdAt: string; lastSeenAt: string };

export type PushState = {
  enabled: boolean;
  deviceCount: number;
  devices: PushDeviceSummary[];
  lastSentAt: string | null;
  publicKey: string;
};

export type PushSender = (
  record: PushSubscriptionRecord,
  payload: string,
) => Promise<{ statusCode?: number }>;

function readJson<T>(key: string, fallback: T): T {
  const raw = getSetting(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Claves VAPID: se reutilizan las de entorno si existen, si no se generan una vez. */
export function getVapidKeys(): { publicKey: string; privateKey: string } {
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate };
  }

  const storedPublic = getSetting(PUSH_VAPID_PUBLIC_KEY);
  const storedPrivate = getSetting(PUSH_VAPID_PRIVATE_KEY);
  if (storedPublic && storedPrivate) {
    return { publicKey: storedPublic, privateKey: storedPrivate };
  }

  const generated = webpush.generateVAPIDKeys();
  setSetting(PUSH_VAPID_PUBLIC_KEY, generated.publicKey);
  setSetting(PUSH_VAPID_PRIVATE_KEY, generated.privateKey);
  return generated;
}

export function isPushEnabled(): boolean {
  return getSetting(PUSH_ENABLED_KEY, '1') !== '0';
}

export function setPushEnabled(enabled: boolean): void {
  setSetting(PUSH_ENABLED_KEY, enabled ? '1' : '0');
}

export function listSubscriptions(): PushSubscriptionRecord[] {
  const rows = readJson<PushSubscriptionRecord[]>(PUSH_SUBSCRIPTIONS_KEY, []);
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (row) => Boolean(row?.endpoint) && Boolean(row?.keys?.p256dh) && Boolean(row?.keys?.auth),
  );
}

function writeSubscriptions(rows: PushSubscriptionRecord[]): void {
  setSetting(PUSH_SUBSCRIPTIONS_KEY, JSON.stringify(rows.slice(-MAX_PUSH_SUBSCRIPTIONS)));
}

/** Guarda (o refresca) el dispositivo autorizado. Un endpoint = un dispositivo. */
export function saveSubscription(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device?: string;
}): { ok: true; deviceCount: number } | { ok: false; error: string } {
  const endpoint = String(input.endpoint ?? '').trim();
  if (!endpoint || !/^https:\/\//i.test(endpoint)) {
    return { ok: false, error: 'Suscripción inválida.' };
  }
  if (!input.keys?.p256dh || !input.keys?.auth) {
    return { ok: false, error: 'Suscripción inválida.' };
  }

  const now = new Date().toISOString();
  const rows = listSubscriptions();
  const existing = rows.find((row) => row.endpoint === endpoint);
  if (existing) {
    existing.keys = { p256dh: input.keys.p256dh, auth: input.keys.auth };
    existing.lastSeenAt = now;
    if (input.device) existing.device = input.device.slice(0, 80);
    writeSubscriptions(rows);
    return { ok: true, deviceCount: listSubscriptions().length };
  }

  rows.push({
    endpoint,
    keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
    device: (input.device || 'Dispositivo').slice(0, 80),
    createdAt: now,
    lastSeenAt: now,
  });
  writeSubscriptions(rows);
  return { ok: true, deviceCount: listSubscriptions().length };
}

export function removeSubscription(endpoint: string): number {
  const target = String(endpoint ?? '').trim();
  const rows = listSubscriptions().filter((row) => row.endpoint !== target);
  writeSubscriptions(rows);
  return rows.length;
}

export function hasBeenSent(key: string): boolean {
  return readJson<string[]>(PUSH_SENT_KEY, []).includes(key);
}

function markSent(key: string): void {
  const rows = readJson<string[]>(PUSH_SENT_KEY, []).filter((item) => item !== key);
  rows.push(key);
  setSetting(PUSH_SENT_KEY, JSON.stringify(rows.slice(-MAX_SENT_KEYS)));
  setSetting(PUSH_LAST_SENT_KEY, new Date().toISOString());
}

export function getPushState(): PushState {
  const rows = listSubscriptions();
  return {
    enabled: isPushEnabled(),
    deviceCount: rows.length,
    devices: rows.map((row) => ({
      device: row.device,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
    })),
    lastSentAt: getSetting(PUSH_LAST_SENT_KEY) || null,
    publicKey: getVapidKeys().publicKey,
  };
}

/** Etiqueta legible del dispositivo a partir del User-Agent. */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent || '';
  const os = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iPhone/iPad'
      : /windows/i.test(ua)
        ? 'Windows'
        : /mac os|macintosh/i.test(ua)
          ? 'Mac'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'Dispositivo';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /chrome|crios/i.test(ua)
      ? 'Chrome'
      : /firefox|fxios/i.test(ua)
        ? 'Firefox'
        : /safari/i.test(ua)
          ? 'Safari'
          : 'Navegador';
  return `${os} · ${browser}`;
}

function vapidSubject(): string {
  const email = getSetting('store_email').trim();
  return email ? `mailto:${email}` : DEFAULT_SUBJECT;
}

export function createWebPushSender(keys: { publicKey: string; privateKey: string }): PushSender {
  return async (record, payload) => {
    webpush.setVapidDetails(vapidSubject(), keys.publicKey, keys.privateKey);
    const result = await webpush.sendNotification(
      { endpoint: record.endpoint, keys: record.keys },
      payload,
      { TTL: 3600, urgency: 'high' },
    );
    return { statusCode: result.statusCode };
  };
}

/**
 * Envía el aviso a todos los dispositivos autorizados.
 * - Respeta el interruptor del panel.
 * - Deduplica por `event.key`: cada pedido, recarga o comprobante avisa una sola vez.
 * - Elimina suscripciones caducadas (404/410) sin afectar al resto.
 */
export async function sendAdminPush(
  event: AdminPushEvent,
  options: { sender?: PushSender } = {},
): Promise<PushSendResult> {
  if (!isPushEnabled()) {
    return { ok: false, sent: 0, failed: 0, reason: 'deshabilitado' };
  }
  if (hasBeenSent(event.key)) {
    return { ok: false, sent: 0, failed: 0, reason: 'duplicado' };
  }

  const subscriptions = listSubscriptions();
  if (subscriptions.length === 0) {
    return { ok: false, sent: 0, failed: 0, reason: 'sin-dispositivos' };
  }

  let keys: { publicKey: string; privateKey: string };
  try {
    keys = getVapidKeys();
  } catch {
    return { ok: false, sent: 0, failed: 0, reason: 'sin-claves' };
  }

  const sender = options.sender ?? createWebPushSender(keys);
  const payload = JSON.stringify({ ...event, timestamp: Date.now() });

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subscriptions.map(async (record) => {
      try {
        await sender(record, payload);
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          removeSubscription(record.endpoint);
        }
      }
    }),
  );

  markSent(event.key);
  return { ok: sent > 0, sent, failed };
}

export function buildOrderNotification(input: {
  orderId: number;
  orderNumber: string;
  totalCents: number;
  methodName?: string;
}): AdminPushEvent {
  const parts = [`Pedido ${input.orderNumber}`, formatPEN(input.totalCents)];
  if (input.methodName) parts.push(input.methodName);
  return {
    key: `pedido:${input.orderId}`,
    kind: 'pedido',
    title: '🛒 NUEVO PEDIDO',
    body: `Un cliente acaba de realizar una compra. ${parts.join(' · ')}`,
    url: `/admin/pedidos?q=${encodeURIComponent(input.orderNumber)}`,
    tag: `pedido-${input.orderId}`,
  };
}

export function buildRechargeNotification(input: {
  id: number;
  amountCents: number;
  methodName?: string;
}): AdminPushEvent {
  const method = input.methodName ? ` · ${input.methodName}` : '';
  return {
    key: `recarga:${input.id}`,
    kind: 'recarga',
    title: '💰 NUEVA RECARGA',
    body: `Un cliente ha solicitado una recarga de saldo. Importe: ${formatPEN(
      input.amountCents,
    )}${method} · Pendiente de aprobación.`,
    url: '/admin/recargas?estado=pendiente',
    tag: `recarga-${input.id}`,
  };
}

export function buildProofNotification(input: {
  orderId: number;
  orderNumber: string;
  totalCents: number;
}): AdminPushEvent {
  return {
    key: `comprobante:${input.orderId}`,
    kind: 'comprobante',
    title: '💳 NUEVO COMPROBANTE',
    body: `Un cliente ha enviado un comprobante de pago. Pedido ${input.orderNumber} · ${formatPEN(
      input.totalCents,
    )} · Requiere revisión.`,
    url: '/admin/comprobantes',
    tag: `comprobante-${input.orderId}`,
  };
}

export async function notifyAdminNewOrder(input: {
  orderId: number;
  orderNumber: string;
  totalCents: number;
  methodName?: string;
}): Promise<PushSendResult> {
  return sendAdminPush(buildOrderNotification(input));
}

export async function notifyAdminNewRecharge(input: {
  id: number;
  amountCents: number;
  methodName?: string;
}): Promise<PushSendResult> {
  return sendAdminPush(buildRechargeNotification(input));
}

export async function notifyAdminNewProof(input: {
  orderId: number;
  orderNumber: string;
  totalCents: number;
}): Promise<PushSendResult> {
  return sendAdminPush(buildProofNotification(input));
}
