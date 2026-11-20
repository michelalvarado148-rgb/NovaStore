/**
 * Datos de entrega de un pedido (correos, contraseñas, perfiles, PIN, vencimientos
 * e instrucciones que el administrador envía al cliente).
 *
 * Se guardan en `settings` con la clave `delivery:<orderId>`: así viajan a
 * Supabase con el resto de la configuración, entran en las copias de seguridad
 * y quedan excluidos del escaparate público (ver getSettings en catalog.ts).
 */
import { getDb } from './db';
import { isDeliveryKind, type DeliveryField, type DeliveryKind } from './delivery-kinds';

export type { DeliveryField, DeliveryKind };

export interface OrderDelivery {
  fields: DeliveryField[];
  instructions: string;
  updatedAt: string | null;
}

const KEY_PREFIX = 'delivery:';
const MAX_FIELDS = 20;
const MAX_LABEL = 60;
const MAX_VALUE = 800;
const MAX_INSTRUCTIONS = 4000;

function deliveryKey(orderId: number): string {
  return `${KEY_PREFIX}${orderId}`;
}

function normalizeFields(raw: unknown): DeliveryField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      label: String(item.label ?? '').trim(),
      value: String(item.value ?? '').trim(),
      kind: isDeliveryKind(item.kind) ? item.kind : ('texto' as DeliveryKind),
    }))
    .filter((field) => field.label !== '' && field.value !== '');
}

export function getOrderDelivery(orderId: number): OrderDelivery | null {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(deliveryKey(orderId)) as { value: string } | undefined;
  if (!row) return null;

  try {
    const parsed = JSON.parse(row.value) as Record<string, unknown>;
    const fields = normalizeFields(parsed.fields);
    const instructions = typeof parsed.instructions === 'string' ? parsed.instructions.trim() : '';
    if (fields.length === 0 && instructions === '') return null;
    return {
      fields,
      instructions,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return null;
  }
}

export function saveOrderDelivery(
  orderId: number,
  input: { fields: { label?: string; value?: string; kind?: string }[]; instructions?: string },
): { ok: true; delivery: OrderDelivery } | { ok: false; error: string } {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { ok: false, error: 'Pedido inválido.' };
  }

  const fields = normalizeFields(input.fields).slice(0, MAX_FIELDS).map((field) => ({
    label: field.label.slice(0, MAX_LABEL),
    value: field.value.slice(0, MAX_VALUE),
    kind: field.kind,
  }));
  const instructions = String(input.instructions ?? '').trim().slice(0, MAX_INSTRUCTIONS);

  if (fields.length === 0 && instructions === '') {
    return {
      ok: false,
      error: 'Agrega al menos un dato de entrega o unas instrucciones para el cliente.',
    };
  }

  const delivery: OrderDelivery = {
    fields,
    instructions,
    updatedAt: new Date().toISOString(),
  };

  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(deliveryKey(orderId), JSON.stringify(delivery));

  return { ok: true, delivery };
}

export function deleteOrderDelivery(orderId: number): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(deliveryKey(orderId));
}

/** Pedidos (de la lista dada) que ya tienen datos de entrega guardados. */
export function getDeliveredOrderIds(orderIds: number[]): Set<number> {
  const result = new Set<number>();
  if (orderIds.length === 0) return result;

  const rows = getDb()
    .prepare("SELECT key FROM settings WHERE key LIKE 'delivery:%'")
    .all() as { key: string }[];
  const wanted = new Set(orderIds);
  for (const row of rows) {
    const id = Number(row.key.slice(KEY_PREFIX.length));
    if (Number.isInteger(id) && wanted.has(id)) result.add(id);
  }
  return result;
}

export interface PurchaseMeta {
  name: string;
  imageUrl: string | null;
  lines: number;
}

/** Nombre, imagen y número de líneas del primer producto de cada pedido. */
export function getPurchaseMeta(orderIds: number[]): Map<number, PurchaseMeta> {
  const map = new Map<number, PurchaseMeta>();
  if (orderIds.length === 0) return map;

  const placeholders = orderIds.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(
      `SELECT oi.order_id AS order_id, oi.product_name AS product_name,
              COALESCE(p.image_url, '') AS image_url
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id IN (${placeholders})
        ORDER BY oi.id`,
    )
    .all(...orderIds) as { order_id: number; product_name: string; image_url: string }[];

  for (const row of rows) {
    const current = map.get(row.order_id);
    if (!current) {
      map.set(row.order_id, {
        name: row.product_name,
        imageUrl: row.image_url || null,
        lines: 1,
      });
    } else {
      current.lines += 1;
    }
  }
  return map;
}

/** Marca el pedido como entregado sin tocar importes, stock ni saldo. */
export function markOrderDelivered(orderId: number, adminId: number): void {
  getDb()
    .prepare(
      `UPDATE orders
          SET status = 'entregado',
              reviewed_by = ?,
              reviewed_at = datetime('now'),
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(adminId, orderId);
}
