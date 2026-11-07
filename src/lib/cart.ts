import { cookies } from 'next/headers';
import { CART_COOKIE, getCurrentUser } from './auth';
import { getDb, newToken, nowIso } from './db';
import { computePricing, getActiveOffers, type Offer } from './catalog';

export type CartLine = {
  item_id: number;
  product_id: number;
  variant_id: number | null;
  name: string;
  slug: string;
  image_url: string | null;
  variant_name: string | null;
  unit_price_cents: number;
  compare_price_cents: number | null;
  discount_percent: number;
  quantity: number;
  line_total_cents: number;
  stock: number | null;
  is_active: number;
};

export type CartDetail = {
  cartId: number | null;
  lines: CartLine[];
  subtotal_cents: number;
  savings_cents: number;
  count: number;
};

type RawLine = {
  item_id: number;
  quantity: number;
  product_id: number;
  variant_id: number | null;
  name: string;
  slug: string;
  image_url: string | null;
  price_cents: number;
  compare_price_cents: number | null;
  category_id: number | null;
  is_active: number;
  product_stock: number | null;
  variant_name: string | null;
  variant_price: number | null;
  variant_stock: number | null;
};

const EMPTY_CART: CartDetail = {
  cartId: null,
  lines: [],
  subtotal_cents: 0,
  savings_cents: 0,
  count: 0,
};

export function emptyCart(): CartDetail {
  return { ...EMPTY_CART, lines: [] };
}

function cartByUser(userId: number): { id: number } | undefined {
  return getDb().prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as
    | { id: number }
    | undefined;
}

function cartByToken(token: string): { id: number } | undefined {
  return getDb().prepare('SELECT id FROM carts WHERE token = ?').get(token) as
    | { id: number }
    | undefined;
}

/** Lectura sin efectos secundarios: segura para renderizar páginas. */
export async function readCartId(): Promise<number | null> {
  const user = await getCurrentUser();
  if (user) {
    const cart = cartByUser(user.id);
    return cart?.id ?? null;
  }
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (!token) return null;
  return cartByToken(token)?.id ?? null;
}

/** Crea el carrito si es necesario. Solo debe usarse dentro de Server Actions. */
export async function ensureCartId(): Promise<number> {
  const db = getDb();
  const user = await getCurrentUser();

  if (user) {
    const existing = cartByUser(user.id);
    if (existing) return existing.id;
    const info = db
      .prepare('INSERT INTO carts (token, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(`u_${user.id}_${newToken()}`, user.id, nowIso(), nowIso());
    return Number(info.lastInsertRowid);
  }

  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (token) {
    const existing = cartByToken(token);
    if (existing) return existing.id;
  }

  const newCartToken = newToken();
  const info = db
    .prepare('INSERT INTO carts (token, user_id, created_at, updated_at) VALUES (?, NULL, ?, ?)')
    .run(newCartToken, nowIso(), nowIso());
  store.set(CART_COOKIE, newCartToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return Number(info.lastInsertRowid);
}

function rawLines(cartId: number): RawLine[] {
  return getDb()
    .prepare(
      `SELECT ci.id AS item_id, ci.quantity, ci.product_id, ci.variant_id,
              p.name, p.slug, p.image_url, p.price_cents, p.compare_price_cents,
              p.category_id, p.is_active, p.stock AS product_stock,
              v.name AS variant_name, v.price_cents AS variant_price, v.stock AS variant_stock
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         LEFT JOIN product_variants v ON v.id = ci.variant_id
        WHERE ci.cart_id = ?
        ORDER BY ci.id ASC`,
    )
    .all(cartId) as RawLine[];
}

export function buildCartDetail(cartId: number | null, offers?: Offer[]): CartDetail {
  if (!cartId) return emptyCart();
  const activeOffers = offers ?? getActiveOffers();
  const lines: CartLine[] = [];
  let subtotal = 0;
  let savings = 0;

  for (const raw of rawLines(cartId)) {
    const pricing = computePricing(
      {
        id: raw.product_id,
        category_id: raw.category_id,
        price_cents: raw.variant_price ?? raw.price_cents,
        compare_price_cents: raw.compare_price_cents,
      },
      activeOffers,
    );
    const unit = pricing.priceCents;
    const compare = pricing.comparePriceCents ?? unit;
    const lineTotal = unit * raw.quantity;
    subtotal += lineTotal;
    savings += Math.max(0, compare - unit) * raw.quantity;

    lines.push({
      item_id: raw.item_id,
      product_id: raw.product_id,
      variant_id: raw.variant_id,
      name: raw.name,
      slug: raw.slug,
      image_url: raw.image_url,
      variant_name: raw.variant_name,
      unit_price_cents: unit,
      compare_price_cents: pricing.comparePriceCents,
      discount_percent: pricing.discountPercent,
      quantity: raw.quantity,
      line_total_cents: lineTotal,
      stock: raw.variant_stock !== null ? raw.variant_stock : raw.product_stock,
      is_active: raw.is_active,
    });
  }

  return {
    cartId,
    lines,
    subtotal_cents: subtotal,
    savings_cents: savings,
    count: lines.reduce((total, line) => total + line.quantity, 0),
  };
}

export async function getCart(): Promise<CartDetail> {
  const cartId = await readCartId();
  return buildCartDetail(cartId);
}

export async function getCartCount(): Promise<number> {
  const cartId = await readCartId();
  if (!cartId) return 0;
  const row = getDb()
    .prepare('SELECT COALESCE(SUM(quantity), 0) AS total FROM cart_items WHERE cart_id = ?')
    .get(cartId) as { total: number };
  return row.total ?? 0;
}

export type CartActionResult = { ok: true } | { ok: false; error: string };

export async function addToCart(
  productId: number,
  variantId: number | null,
  quantity: number,
): Promise<CartActionResult> {
  const db = getDb();
  const qty = Math.max(1, Math.min(99, Math.floor(quantity || 1)));

  const product = db
    .prepare('SELECT id, stock, is_active FROM products WHERE id = ?')
    .get(productId) as { id: number; stock: number | null; is_active: number } | undefined;
  if (!product || !product.is_active) {
    return { ok: false, error: 'El producto no está disponible.' };
  }

  let available = product.stock;
  if (variantId) {
    const variant = db
      .prepare('SELECT id, stock, is_active FROM product_variants WHERE id = ? AND product_id = ?')
      .get(variantId, productId) as
      | { id: number; stock: number | null; is_active: number }
      | undefined;
    if (!variant || !variant.is_active) {
      return { ok: false, error: 'La presentación seleccionada no está disponible.' };
    }
    available = variant.stock !== null ? variant.stock : product.stock;
  }

  const cartId = await ensureCartId();
  const existing = db
    .prepare(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id, 0) = ?',
    )
    .get(cartId, productId, variantId ?? 0) as { id: number; quantity: number } | undefined;

  const targetQty = Math.min(qty + (existing?.quantity ?? 0), 99);
  if (available !== null && targetQty > available) {
    return {
      ok: false,
      error:
        available <= 0
          ? 'Producto agotado por el momento.'
          : `Solo quedan ${available} unidades disponibles.`,
    };
  }

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(targetQty, existing.id);
  } else {
    db.prepare(
      'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(cartId, productId, variantId, qty, nowIso());
  }
  db.prepare('UPDATE carts SET updated_at = ? WHERE id = ?').run(nowIso(), cartId);
  return { ok: true };
}

export async function updateCartItem(itemId: number, quantity: number): Promise<CartActionResult> {
  const db = getDb();
  const cartId = await readCartId();
  if (!cartId) return { ok: false, error: 'No hay un carrito activo.' };

  const item = db
    .prepare(
      `SELECT ci.id, ci.product_id, ci.variant_id, p.stock AS product_stock, v.stock AS variant_stock
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         LEFT JOIN product_variants v ON v.id = ci.variant_id
        WHERE ci.id = ? AND ci.cart_id = ?`,
    )
    .get(itemId, cartId) as
    | {
        id: number;
        product_id: number;
        variant_id: number | null;
        product_stock: number | null;
        variant_stock: number | null;
      }
    | undefined;

  if (!item) return { ok: false, error: 'El producto no pertenece a tu carrito.' };

  const qty = Math.floor(quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(itemId, cartId);
    return { ok: true };
  }

  const available = item.variant_stock !== null ? item.variant_stock : item.product_stock;
  if (available !== null && qty > available) {
    return { ok: false, error: `Solo quedan ${available} unidades disponibles.` };
  }

  db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?').run(
    Math.min(qty, 99),
    itemId,
    cartId,
  );
  return { ok: true };
}

export async function removeCartItem(itemId: number): Promise<CartActionResult> {
  const cartId = await readCartId();
  if (!cartId) return { ok: false, error: 'No hay un carrito activo.' };
  getDb().prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(itemId, cartId);
  return { ok: true };
}

export async function clearCart(cartId: number): Promise<void> {
  getDb().prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
}

/** Une el carrito de invitado con el carrito del usuario al iniciar sesión. */
export async function mergeGuestCart(userId: number): Promise<void> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (!token) return;

  const db = getDb();
  const guest = cartByToken(token);
  if (!guest) {
    store.delete(CART_COOKIE);
    return;
  }

  let userCart = cartByUser(userId);
  if (!userCart) {
    db.prepare('UPDATE carts SET user_id = ?, updated_at = ? WHERE id = ?').run(
      userId,
      nowIso(),
      guest.id,
    );
    store.delete(CART_COOKIE);
    return;
  }

  const guestItems = db
    .prepare('SELECT product_id, variant_id, quantity FROM cart_items WHERE cart_id = ?')
    .all(guest.id) as { product_id: number; variant_id: number | null; quantity: number }[];

  const findItem = db.prepare(
    'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id, 0) = ?',
  );
  const insertItem = db.prepare(
    'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const updateItem = db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?');

  const mergeTx = db.transaction(() => {
    for (const item of guestItems) {
      const existing = findItem.get(userCart!.id, item.product_id, item.variant_id ?? 0) as
        | { id: number; quantity: number }
        | undefined;
      if (existing) {
        updateItem.run(Math.min(existing.quantity + item.quantity, 99), existing.id);
      } else {
        insertItem.run(userCart!.id, item.product_id, item.variant_id, item.quantity, nowIso());
      }
    }
    db.prepare('DELETE FROM carts WHERE id = ?').run(guest.id);
  });
  mergeTx();
  store.delete(CART_COOKIE);
}
