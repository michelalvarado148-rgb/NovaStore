/**
 * ID de jugador de Free Fire.
 *
 * El campo se aplica únicamente a los productos que pertenecen a la categoría
 * Free Fire o a una de sus subcategorías (Diamantes, Pases, Cuentas, etc.).
 * No hay que configurarlo producto por producto: se calcula en el servidor a
 * partir de la categoría y se apoya en el sistema de avisos y requisitos que ya
 * existe, así que el dato viaja con el pedido y se ve en el panel admin.
 */
import { getDb } from './db';
import { getCategoryParentMap, getSetting, setSetting } from './catalog';
import { MAX_NOTICE_FIELDS, type NoticeField } from './notice-meta';
import type { ProductNotice } from './product-notice';

export const FREE_FIRE_FIELD_LABEL = 'ID de Free Fire';
export const FREE_FIRE_FIELD_PLACEHOLDER = 'Ingresa tu ID de Free Fire';
export const FREE_FIRE_FIELD_HINT =
  'Verifica que tu ID sea correcto antes de continuar con tu compra.';
export const FREE_FIRE_NOTICE_MESSAGE =
  '🔥 Para completar tu compra necesitamos tu ID de Free Fire. Escribe el número correcto: el producto se envía directamente a esa cuenta.';
export const FREE_FIRE_ID_MIN = 6;
export const FREE_FIRE_ID_MAX = 15;

const FREE_FIRE_ID_PREFIX = 'ff_player:';
const MAX_LEVELS = 8;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** ¿El nombre o el slug corresponden a Free Fire? */
function matchesFreeFire(name: string, slug: string): boolean {
  const text = `${normalize(name)} ${normalize(slug.replace(/[-_]+/g, ' '))}`;
  return text.includes('freefire') || /free ?fire/.test(text);
}

type CategoryRow = { id: number; name: string; slug: string };

/** La categoría y todos sus padres (subcategoría → categoría principal). */
function categoryChain(categoryId: number): CategoryRow[] {
  const db = getDb();
  const parents = getCategoryParentMap();
  const chain: CategoryRow[] = [];
  const seen = new Set<number>();
  let current: number | null = categoryId;
  while (current !== null && chain.length < MAX_LEVELS && !seen.has(current)) {
    seen.add(current);
    const row = db
      .prepare('SELECT id, name, slug FROM categories WHERE id = ?')
      .get(current) as CategoryRow | undefined;
    if (!row) break;
    chain.push(row);
    current = parents[row.id] ?? null;
  }
  return chain;
}

/** La categoría (o cualquiera de sus padres) es de Free Fire. */
export function isFreeFireCategory(categoryId: number | null | undefined): boolean {
  if (!categoryId || !Number.isInteger(categoryId) || categoryId <= 0) return false;
  return categoryChain(categoryId).some((row) => matchesFreeFire(row.name, row.slug));
}

/** El producto pertenece a Free Fire, esté en la principal o en una subcategoría. */
export function isFreeFireProduct(productId: number): boolean {
  if (!Number.isInteger(productId) || productId <= 0) return false;
  const row = getDb()
    .prepare('SELECT category_id FROM products WHERE id = ?')
    .get(productId) as { category_id: number | null } | undefined;
  return isFreeFireCategory(row?.category_id ?? null);
}

export function freeFireField(): NoticeField {
  return {
    label: FREE_FIRE_FIELD_LABEL,
    required: true,
    placeholder: FREE_FIRE_FIELD_PLACEHOLDER,
    hint: FREE_FIRE_FIELD_HINT,
  };
}

/** Valida el ID: obligatorio, solo números y longitud razonable. */
export function validateFreeFireId(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = String(raw ?? '').replace(/[\s-]/g, '');
  if (!value) {
    return { ok: false, error: 'Ingresa tu ID de Free Fire para continuar con la compra.' };
  }
  if (!/^[0-9]+$/.test(value)) {
    return {
      ok: false,
      error: 'El ID de Free Fire solo debe contener números, sin letras ni símbolos.',
    };
  }
  if (value.length < FREE_FIRE_ID_MIN || value.length > FREE_FIRE_ID_MAX) {
    return {
      ok: false,
      error: `El ID de Free Fire debe tener entre ${FREE_FIRE_ID_MIN} y ${FREE_FIRE_ID_MAX} dígitos.`,
    };
  }
  return { ok: true, value };
}

function sameLabel(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

/**
 * Agrega el requisito del ID a los avisos del pedido.
 *
 * Los productos de Free Fire sin aviso configurado reciben uno automático y, si
 * el administrador ya tenía un aviso para ese producto, se le añade el campo
 * obligatorio sin quitar los demás datos.
 */
export function withFreeFireNotices(
  base: Map<number, ProductNotice>,
  lines: { product_id: number; name?: string }[],
): Map<number, ProductNotice> {
  const result = new Map(base);
  for (const line of lines) {
    const productId = Number(line.product_id);
    if (!Number.isInteger(productId) || productId <= 0) continue;
    if (!isFreeFireProduct(productId)) continue;

    const existing = result.get(productId);
    if (!existing) {
      result.set(productId, {
        enabled: true,
        type: 'datos',
        message: FREE_FIRE_NOTICE_MESSAGE,
        deliveryTime: '',
        fields: [freeFireField()],
      });
      continue;
    }

    const current = existing.fields.find((field) => sameLabel(field.label, FREE_FIRE_FIELD_LABEL));
    if (current?.required && current.hint) continue;

    const rest = existing.fields.filter((field) => !sameLabel(field.label, FREE_FIRE_FIELD_LABEL));
    result.set(productId, {
      ...existing,
      enabled: true,
      fields: [freeFireField(), ...rest].slice(0, MAX_NOTICE_FIELDS),
    });
  }
  return result;
}

/** ID recordado del cliente, para rellenar el campo en su próxima compra. */
export function getSavedFreeFireId(userId: number): string {
  if (!Number.isInteger(userId) || userId <= 0) return '';
  return getSetting(`${FREE_FIRE_ID_PREFIX}${userId}`, '');
}

export function saveFreeFireId(userId: number, rawId: string): void {
  if (!Number.isInteger(userId) || userId <= 0) return;
  const check = validateFreeFireId(rawId);
  if (!check.ok) return;
  setSetting(`${FREE_FIRE_ID_PREFIX}${userId}`, check.value);
}

/** Valores iniciales del formulario de checkout para el campo del ID. */
export function freeFireDefaults(
  notices: { productId: number; fields: NoticeField[] }[],
  value: string,
): Record<string, string> {
  const defaults: Record<string, string> = {};
  if (!value) return defaults;
  for (const notice of notices) {
    if (notice.fields.some((field) => sameLabel(field.label, FREE_FIRE_FIELD_LABEL))) {
      defaults[`${notice.productId}:${FREE_FIRE_FIELD_LABEL}`] = value;
    }
  }
  return defaults;
}
