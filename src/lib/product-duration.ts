/**
 * Duración del producto — exclusivo de la categoría Streaming.
 *
 * Se guarda en la tabla `settings` con la clave `duration:<id>` (JSON), igual
 * que `product_notice:<id>` y `qty:<id>`: la tienda ya replica esta tabla con
 * Supabase, así que la configuración es permanente y sobrevive a
 * actualizaciones, cierres de sesión y despliegues sin alterar `products`.
 *
 * Solo se aplica a productos de Streaming. En el resto de categorías el valor
 * guardado se ignora y no se muestra ningún indicador.
 */
import { getDb, nowIso } from './db';
import { getCategories, type Category } from './catalog';
import { detectCategoryKind } from './category-kind';
import {
  PRESET_BY_VALUE,
  durationLabelFor,
  isDurationPreset,
  normalizeCustomDuration,
  type ProductDuration,
} from './duration-presets';

export * from './duration-presets';

export const DURATION_PREFIX = 'duration:';

/* ------------------------- Categorías Streaming ------------------------- */

/** Conjunto de categorías (y subcategorías) que pertenecen a Streaming. */
function streamingIdSet(all: Category[]): Set<number> {
  const byId = new Map(all.map((category) => [category.id, category]));

  const isStreaming = (category: Category): boolean => {
    let current: Category | undefined = category;
    const seen = new Set<number>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (detectCategoryKind(current) === 'streaming') return true;
      current = current.parent_id === null ? undefined : byId.get(current.parent_id);
    }
    return false;
  };

  const streaming = new Set<number>();
  for (const category of all) {
    if (isStreaming(category)) streaming.add(category.id);
  }
  return streaming;
}

/**
 * Identificadores de las categorías de Streaming, incluidas sus subcategorías.
 * Lo usa el panel para saber cuándo mostrar el campo «Duración».
 */
export function getStreamingCategoryIds(): number[] {
  return Array.from(streamingIdSet(getCategories({ includeInactive: true }))).sort((a, b) => a - b);
}

export function isStreamingCategoryId(categoryId: number | null | undefined): boolean {
  if (!categoryId) return false;
  return streamingIdSet(getCategories({ includeInactive: true })).has(categoryId);
}

/* ------------------------------ Lectura ------------------------------- */

function parseStored(raw: string): ProductDuration | null {
  try {
    const data = JSON.parse(raw) as { preset?: unknown; custom?: unknown };
    if (!isDurationPreset(data.preset)) return null;
    const custom = data.preset === 'custom' ? normalizeCustomDuration(String(data.custom ?? '')) : '';
    const label = durationLabelFor(data.preset, custom);
    if (!label) return null;
    return { preset: data.preset, custom, label };
  } catch {
    return null;
  }
}

/** Duración guardada de un producto (aunque su categoría no sea Streaming). */
export function readDuration(productId: number): ProductDuration | null {
  if (!Number.isInteger(productId) || productId <= 0) return null;
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`${DURATION_PREFIX}${productId}`) as { value: string } | undefined;
  return row ? parseStored(row.value) : null;
}

/** Todas las duraciones guardadas: producto → duración. */
export function getDurationConfigMap(): Map<number, ProductDuration> {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'duration:%'")
    .all() as { key: string; value: string }[];
  const map = new Map<number, ProductDuration>();
  for (const row of rows) {
    const id = Number(row.key.slice(DURATION_PREFIX.length));
    if (!Number.isInteger(id) || id <= 0) continue;
    const duration = parseStored(row.value);
    if (duration) map.set(id, duration);
  }
  return map;
}

/**
 * Duración que debe verse en la tienda para cada producto: solo productos de
 * Streaming con duración configurada. Los demás no aparecen en el mapa.
 */
export function getDurationLabels(productIds: number[]): Map<number, string> {
  const ids = Array.from(new Set(productIds.filter((id) => Number.isInteger(id) && id > 0)));
  const labels = new Map<number, string>();
  if (ids.length === 0) return labels;

  const placeholders = ids.map(() => '?').join(',');
  const rows = getDb()
    .prepare(`SELECT id, category_id FROM products WHERE id IN (${placeholders})`)
    .all(...ids) as { id: number; category_id: number | null }[];

  const streaming = streamingIdSet(getCategories({ includeInactive: true }));
  const durations = getDurationConfigMap();

  for (const row of rows) {
    if (!row.category_id || !streaming.has(row.category_id)) continue;
    const duration = durations.get(row.id);
    if (duration) labels.set(row.id, duration.label);
  }
  return labels;
}

/** Duración de un producto concreto, solo si pertenece a Streaming. */
export function getProductDuration(productId: number, categoryId: number | null): ProductDuration | null {
  if (!categoryId || !isStreamingCategoryId(categoryId)) return null;
  return readDuration(productId);
}

/* ------------------------------ Guardado ----------------------------- */

export function deleteProductDuration(productId: number): void {
  getDb()
    .prepare('DELETE FROM settings WHERE key = ?')
    .run(`${DURATION_PREFIX}${productId}`);
}

/**
 * Guarda la duración de un producto. Si la categoría no es Streaming (o se
 * elige «sin duración») se elimina el valor anterior para no dejar datos
 * ocultos que reaparezcan si el producto vuelve a Streaming.
 */
export function saveProductDuration(
  productId: number,
  input: { preset: string; custom: string },
): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(productId) || productId <= 0) {
    return { ok: false, error: 'Producto inválido para guardar la duración.' };
  }

  const product = getDb()
    .prepare('SELECT id, category_id FROM products WHERE id = ?')
    .get(productId) as { id: number; category_id: number | null } | undefined;
  if (!product) return { ok: false, error: 'El producto no existe.' };

  const presetRaw = String(input.preset ?? '').trim();
  const preset = isDurationPreset(presetRaw) ? presetRaw : null;

  if (!preset || !product.category_id || !isStreamingCategoryId(product.category_id)) {
    deleteProductDuration(productId);
    return { ok: true };
  }

  const custom = preset === 'custom' ? normalizeCustomDuration(input.custom) : '';
  if (preset === 'custom' && !custom) {
    return { ok: false, error: 'Escribe la duración personalizada del producto.' };
  }

  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(`${DURATION_PREFIX}${productId}`, JSON.stringify({ preset, custom }), now);

  void PRESET_BY_VALUE;
  return { ok: true };
}
