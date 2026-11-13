/**
 * Avisos y requisitos personalizados por producto.
 *
 * Se guardan en la tabla `settings` con la clave `product_notice:<id>` (JSON),
 * la misma tabla que ya se replica en Supabase, así que la configuración es
 * permanente y sobrevive a actualizaciones, cierres de sesión y despliegues.
 *
 * Los datos que el cliente escribe al confirmar el aviso se guardan con el
 * pedido en `order_inputs:<número de pedido>`.
 */
import { getDb, nowIso } from './db';
import {
  MAX_FIELD_LABEL,
  MAX_FIELD_VALUE,
  MAX_NOTICE_FIELDS,
  MAX_NOTICE_MESSAGE,
  NOTICE_TYPES,
  defaultNoticeMessage,
  type NoticeField,
  type NoticeType,
  type OrderNoticeAnswer,
  type PublicProductNotice,
} from './notice-meta';

export type ProductNotice = {
  enabled: boolean;
  type: NoticeType;
  message: string;
  deliveryTime: string;
  fields: NoticeField[];
  updatedAt?: string;
};

export type NoticeInput = {
  enabled: boolean;
  type: string;
  message: string;
  deliveryTime: string;
  fields: { label: string; required: boolean }[];
};

export const PRODUCT_NOTICE_PREFIX = 'product_notice:';
export const ORDER_INPUTS_PREFIX = 'order_inputs:';

function isNoticeType(value: unknown): value is NoticeType {
  return NOTICE_TYPES.some((item) => item.value === value);
}

function normalizeFields(raw: unknown): NoticeField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const fields: NoticeField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const label = String((item as { label?: unknown }).label ?? '')
      .trim()
      .slice(0, MAX_FIELD_LABEL);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({ label, required: Boolean((item as { required?: unknown }).required) });
    if (fields.length >= MAX_NOTICE_FIELDS) break;
  }
  return fields;
}

function parseStored(raw: string): ProductNotice | null {
  try {
    const data = JSON.parse(raw) as Partial<ProductNotice>;
    const type = isNoticeType(data.type) ? data.type : 'personalizado';
    return {
      enabled: Boolean(data.enabled),
      type,
      message: String(data.message ?? '').slice(0, MAX_NOTICE_MESSAGE),
      deliveryTime: String(data.deliveryTime ?? '').slice(0, 80),
      fields: normalizeFields(data.fields),
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

function readConfig(productId: number): ProductNotice | null {
  if (!Number.isInteger(productId) || productId <= 0) return null;
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`${PRODUCT_NOTICE_PREFIX}${productId}`) as { value: string } | undefined;
  return row ? parseStored(row.value) : null;
}

/** Configuración completa (aunque esté desactivada). Uso del panel admin. */
export function getProductNoticeConfig(productId: number): ProductNotice | null {
  return readConfig(productId);
}

/** Aviso activo que debe verse en la tienda; null si no está configurado. */
export function getProductNotice(productId: number): ProductNotice | null {
  const config = readConfig(productId);
  if (!config || !config.enabled) return null;
  return config;
}

function readAll(productIds?: number[]): Map<number, ProductNotice> {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'product_notice:%'")
    .all() as { key: string; value: string }[];
  const wanted = productIds ? new Set(productIds) : null;
  const map = new Map<number, ProductNotice>();
  for (const row of rows) {
    const id = Number(row.key.slice(PRODUCT_NOTICE_PREFIX.length));
    if (!Number.isInteger(id) || id <= 0) continue;
    if (wanted && !wanted.has(id)) continue;
    const config = parseStored(row.value);
    if (config) map.set(id, config);
  }
  return map;
}

/** Avisos activos de un conjunto de productos (checkout / tarjetas). */
export function getActiveNotices(productIds: number[]): Map<number, ProductNotice> {
  const map = new Map<number, ProductNotice>();
  for (const [id, config] of readAll(productIds)) {
    if (config.enabled) map.set(id, config);
  }
  return map;
}

/** Todas las configuraciones guardadas, para marcar productos en el panel. */
export function getNoticeConfigMap(): Map<number, ProductNotice> {
  return readAll();
}

export function saveProductNotice(
  productId: number,
  input: NoticeInput,
): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(productId) || productId <= 0) {
    return { ok: false, error: 'Producto inválido para guardar el aviso.' };
  }
  const type: NoticeType = isNoticeType(input.type) ? input.type : 'personalizado';
  const deliveryTime = String(input.deliveryTime ?? '')
    .trim()
    .slice(0, 80);

  let message = String(input.message ?? '')
    .trim()
    .slice(0, MAX_NOTICE_MESSAGE);
  if (!message) message = defaultNoticeMessage(type, deliveryTime);
  if (type === 'personalizado' && !message) {
    return { ok: false, error: 'Escribe el mensaje del aviso personalizado.' };
  }

  const fields = normalizeFields(input.fields);

  const payload: ProductNotice = {
    enabled: Boolean(input.enabled),
    type,
    message,
    deliveryTime: type === 'demora' && !deliveryTime ? '15 a 30 minutos' : deliveryTime,
    fields,
    updatedAt: nowIso(),
  };

  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(`${PRODUCT_NOTICE_PREFIX}${productId}`, JSON.stringify(payload), payload.updatedAt!);

  return { ok: true };
}

export function deleteProductNotice(productId: number): void {
  getDb()
    .prepare('DELETE FROM settings WHERE key = ?')
    .run(`${PRODUCT_NOTICE_PREFIX}${productId}`);
}

/* ----------------------- Datos enviados por el cliente ---------------------- */

export function saveOrderNoticeAnswers(orderNumber: string, answers: OrderNoticeAnswer[]): void {
  if (!orderNumber || answers.length === 0) return;
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(`${ORDER_INPUTS_PREFIX}${orderNumber}`, JSON.stringify(answers), now);
}

export function getOrderNoticeAnswers(orderNumber: string): OrderNoticeAnswer[] {
  if (!orderNumber) return [];
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`${ORDER_INPUTS_PREFIX}${orderNumber}`) as { value: string } | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        productId: Number(item.productId) || 0,
        productName: String(item.productName ?? ''),
        type: isNoticeType(item.type) ? item.type : 'personalizado',
        message: String(item.message ?? ''),
        deliveryTime: String(item.deliveryTime ?? ''),
        values: Array.isArray(item.values)
          ? item.values.map((value: { label?: unknown; value?: unknown; required?: unknown }) => ({
              label: String(value?.label ?? '').slice(0, MAX_FIELD_LABEL),
              value: String(value?.value ?? '').slice(0, MAX_FIELD_VALUE),
              required: Boolean(value?.required),
            }))
          : [],
        acknowledgedAt: String(item.acknowledgedAt ?? ''),
      }));
  } catch {
    return [];
  }
}

/** Aviso activo listo para el navegador. */
export function toPublicNotice(
  productId: number,
  productName: string,
  config: ProductNotice,
): PublicProductNotice {
  return {
    productId,
    productName,
    type: config.type,
    message: config.message,
    deliveryTime: config.deliveryTime,
    fields: config.fields,
  };
}
