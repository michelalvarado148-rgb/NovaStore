import { getDb, nowIso } from './db';
import { normalizeQtyConfig, type QtyConfig, DEFAULT_QTY_CONFIG } from './qty-rules';

/**
 * Almacenamiento de la configuración de cantidad personalizada.
 *
 * Se guarda en la tabla `settings` con la clave `qty:<id>` (igual que las
 * subcategorías en `cat_parent:<id>` y los avisos en `product_notice:<id>`):
 * la conexión de la tienda con Supabase no tiene permisos para alterar la
 * tabla `products`, así que no se añaden columnas al esquema.
 */

export const QTY_PREFIX = 'qty:';

export * from './qty-rules';

function parseConfig(raw: string | null | undefined): QtyConfig {
  if (!raw) return DEFAULT_QTY_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<QtyConfig>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_QTY_CONFIG;
    return normalizeQtyConfig(parsed);
  } catch {
    return DEFAULT_QTY_CONFIG;
  }
}

/** Configuración guardada de un producto. */
export function readQtyConfig(productId: number): QtyConfig {
  if (!Number.isInteger(productId) || productId <= 0) return DEFAULT_QTY_CONFIG;
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`${QTY_PREFIX}${productId}`) as { value: string } | undefined;
  return parseConfig(row?.value);
}

/** Configuración de varios productos en una sola consulta. */
export function readQtyConfigs(productIds: number[]): Map<number, QtyConfig> {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  const map = new Map<number, QtyConfig>();
  if (ids.length === 0) return map;

  const placeholders = ids.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .all(...ids.map((id) => `${QTY_PREFIX}${id}`)) as { key: string; value: string }[];

  for (const row of rows) {
    const id = Number(row.key.slice(QTY_PREFIX.length));
    if (!Number.isInteger(id)) continue;
    map.set(id, parseConfig(row.value));
  }
  for (const id of ids) {
    if (!map.has(id)) map.set(id, DEFAULT_QTY_CONFIG);
  }
  return map;
}

/** Guarda (o borra) la configuración del producto. */
export function saveQtyConfig(productId: number, input: Partial<QtyConfig>): QtyConfig {
  const config = normalizeQtyConfig(input);
  const key = `${QTY_PREFIX}${productId}`;
  if (!config.enabled) {
    getDb().prepare('DELETE FROM settings WHERE key = ?').run(key);
    return { ...config, enabled: false };
  }
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(config), nowIso());
  return config;
}

export function clearQtyConfig(productId: number): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(`${QTY_PREFIX}${productId}`);
}
