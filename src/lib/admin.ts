import { getDb, nowIso } from './db';
import { slugify } from './format';

/* ----------------------------- Productos ----------------------------- */

export type VariantInput = {
  id?: number;
  name: string;
  priceCents: number | null;
  stock: number | null;
  isActive?: boolean;
};

export type ProductInput = {
  id?: number;
  name: string;
  description: string;
  categoryId: number | null;
  imageUrl: string | null;
  priceCents: number;
  comparePriceCents: number | null;
  stock: number | null;
  isActive: boolean;
  isFeatured: boolean;
  variants: VariantInput[];
};

export type AdminProduct = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  price_cents: number;
  compare_price_cents: number | null;
  stock: number | null;
  is_active: number;
  is_featured: number;
  sold_count: number;
  category_id: number | null;
  category_name: string | null;
};

function uniqueSlug(base: string, table: 'products' | 'categories', ignoreId?: number): string {
  const db = getDb();
  const root = slugify(base) || 'item';
  let candidate = root;
  let counter = 2;
  for (;;) {
    const row = db
      .prepare(`SELECT id FROM ${table} WHERE slug = ?`)
      .get(candidate) as { id: number } | undefined;
    if (!row || row.id === ignoreId) return candidate;
    candidate = `${root}-${counter}`;
    counter += 1;
  }
}

export function listAdminProducts(): AdminProduct[] {
  return getDb()
    .prepare(
      `SELECT p.id, p.name, p.slug, p.description, p.image_url, p.price_cents,
              p.compare_price_cents, p.stock, p.is_active, p.is_featured, p.sold_count,
              p.category_id, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.id DESC`,
    )
    .all() as AdminProduct[];
}

export function saveProduct(input: ProductInput): { ok: true; id: number } | { ok: false; error: string } {
  const db = getDb();
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: 'El nombre del producto es muy corto.' };
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
    return { ok: false, error: 'El precio debe ser un número válido en soles.' };
  }
  if (input.comparePriceCents !== null && input.comparePriceCents < input.priceCents) {
    return { ok: false, error: 'El precio de comparación debe ser mayor o igual al precio.' };
  }
  if (input.stock !== null && (!Number.isInteger(input.stock) || input.stock < 0)) {
    return { ok: false, error: 'El stock debe ser un número entero mayor o igual a cero.' };
  }

  const now = nowIso();
  const tx = db.transaction(() => {
    let productId = input.id ?? 0;
    if (input.id) {
      const slug = uniqueSlug(name, 'products', input.id);
      db.prepare(
        `UPDATE products SET category_id = ?, name = ?, slug = ?, description = ?, image_url = ?,
                price_cents = ?, compare_price_cents = ?, stock = ?, is_active = ?, is_featured = ?,
                updated_at = ?
          WHERE id = ?`,
      ).run(
        input.categoryId,
        name,
        slug,
        input.description.trim(),
        input.imageUrl,
        input.priceCents,
        input.comparePriceCents,
        input.stock,
        input.isActive ? 1 : 0,
        input.isFeatured ? 1 : 0,
        now,
        input.id,
      );
    } else {
      const slug = uniqueSlug(name, 'products');
      const info = db
        .prepare(
          `INSERT INTO products (category_id, name, slug, description, image_url, price_cents,
                                 compare_price_cents, stock, is_active, is_featured, sold_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .run(
          input.categoryId,
          name,
          slug,
          input.description.trim(),
          input.imageUrl,
          input.priceCents,
          input.comparePriceCents,
          input.stock,
          input.isActive ? 1 : 0,
          input.isFeatured ? 1 : 0,
          now,
          now,
        );
      productId = Number(info.lastInsertRowid);
    }

    const keptIds: number[] = [];
    input.variants.forEach((variant, index) => {
      const variantName = variant.name.trim();
      if (!variantName) return;
      if (variant.id) {
        db.prepare(
          `UPDATE product_variants SET name = ?, price_cents = ?, stock = ?, position = ?, is_active = ?
            WHERE id = ? AND product_id = ?`,
        ).run(
          variantName,
          variant.priceCents,
          variant.stock,
          index,
          variant.isActive === false ? 0 : 1,
          variant.id,
          productId,
        );
        keptIds.push(variant.id);
      } else {
        const info = db
          .prepare(
            `INSERT INTO product_variants (product_id, name, price_cents, stock, position, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(productId, variantName, variant.priceCents, variant.stock, index, variant.isActive === false ? 0 : 1);
        keptIds.push(Number(info.lastInsertRowid));
      }
    });

    const existing = db
      .prepare('SELECT id FROM product_variants WHERE product_id = ?')
      .all(productId) as { id: number }[];
    for (const row of existing) {
      if (!keptIds.includes(row.id)) {
        db.prepare('DELETE FROM product_variants WHERE id = ?').run(row.id);
      }
    }

    return productId;
  });

  return { ok: true, id: tx() };
}

export function deleteProduct(id: number): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const used = db
    .prepare('SELECT COUNT(*) AS total FROM order_items WHERE product_id = ?')
    .get(id) as { total: number };
  if (used.total > 0) {
    // Preservamos el historial: en lugar de borrar, desactivamos.
    db.prepare('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
    return {
      ok: false,
      error: 'El producto tiene pedidos asociados, así que se desactivó para conservar el historial.',
    };
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return { ok: true };
}

/* ----------------------------- Categorías ---------------------------- */

export function saveCategory(input: {
  id?: number;
  name: string;
  description: string;
  imageUrl: string | null;
  position: number;
  isActive: boolean;
}): { ok: true; id: number } | { ok: false; error: string } {
  const db = getDb();
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: 'El nombre de la categoría es muy corto.' };

  const duplicate = db
    .prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE')
    .get(name) as { id: number } | undefined;
  if (duplicate && duplicate.id !== input.id) {
    return { ok: false, error: 'Ya existe una categoría con ese nombre.' };
  }

  if (input.id) {
    db.prepare(
      `UPDATE categories SET name = ?, slug = ?, description = ?, image_url = ?, position = ?, is_active = ?
        WHERE id = ?`,
    ).run(
      name,
      uniqueSlug(name, 'categories', input.id),
      input.description.trim(),
      input.imageUrl,
      input.position,
      input.isActive ? 1 : 0,
      input.id,
    );
    return { ok: true, id: input.id };
  }

  const info = db
    .prepare(
      `INSERT INTO categories (name, slug, description, image_url, position, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      name,
      uniqueSlug(name, 'categories'),
      input.description.trim(),
      input.imageUrl,
      input.position,
      input.isActive ? 1 : 0,
      nowIso(),
    );
  return { ok: true, id: Number(info.lastInsertRowid) };
}

export function deleteCategory(id: number): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const products = db
    .prepare('SELECT COUNT(*) AS total FROM products WHERE category_id = ?')
    .get(id) as { total: number };
  if (products.total > 0) {
    return {
      ok: false,
      error: `La categoría tiene ${products.total} producto(s). Muévelos a otra categoría antes de eliminarla.`,
    };
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { ok: true };
}

/* ------------------------------ Ofertas ------------------------------ */

export type AdminOffer = {
  id: number;
  title: string;
  description: string;
  product_id: number | null;
  category_id: number | null;
  discount_percent: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  product_name: string | null;
  category_name: string | null;
};

export function listAdminOffers(): AdminOffer[] {
  return getDb()
    .prepare(
      `SELECT o.*, p.name AS product_name, c.name AS category_name
         FROM offers o
         LEFT JOIN products p ON p.id = o.product_id
         LEFT JOIN categories c ON c.id = o.category_id
        ORDER BY o.id DESC`,
    )
    .all() as AdminOffer[];
}

export function saveOffer(input: {
  id?: number;
  title: string;
  description: string;
  productId: number | null;
  categoryId: number | null;
  discountPercent: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const title = input.title.trim();
  if (title.length < 3) return { ok: false, error: 'El título de la oferta es muy corto.' };
  if (!Number.isInteger(input.discountPercent) || input.discountPercent < 1 || input.discountPercent > 90) {
    return { ok: false, error: 'El descuento debe estar entre 1% y 90%.' };
  }
  if (input.productId && input.categoryId) {
    return { ok: false, error: 'Elige un producto o una categoría, no ambos.' };
  }

  if (input.id) {
    db.prepare(
      `UPDATE offers SET title = ?, description = ?, product_id = ?, category_id = ?,
              discount_percent = ?, starts_at = ?, ends_at = ?, is_active = ?
        WHERE id = ?`,
    ).run(
      title,
      input.description.trim(),
      input.productId,
      input.categoryId,
      input.discountPercent,
      input.startsAt,
      input.endsAt,
      input.isActive ? 1 : 0,
      input.id,
    );
    return { ok: true };
  }

  db.prepare(
    `INSERT INTO offers (title, description, product_id, category_id, discount_percent, starts_at, ends_at, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    title,
    input.description.trim(),
    input.productId,
    input.categoryId,
    input.discountPercent,
    input.startsAt,
    input.endsAt,
    input.isActive ? 1 : 0,
    nowIso(),
  );
  return { ok: true };
}

export function toggleOffer(id: number): void {
  getDb().prepare('UPDATE offers SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
}

export function deleteOffer(id: number): void {
  getDb().prepare('DELETE FROM offers WHERE id = ?').run(id);
}

/* -------------------------- Métodos de pago -------------------------- */

export function listAdminPaymentMethods() {
  return getDb()
    .prepare('SELECT * FROM payment_methods ORDER BY position ASC, id ASC')
    .all() as {
    id: number;
    code: string;
    name: string;
    description: string;
    account_info: string;
    instructions: string;
    is_enabled: number;
    position: number;
  }[];
}

export function savePaymentMethod(input: {
  id: number;
  name: string;
  description: string;
  accountInfo: string;
  instructions: string;
  isEnabled: boolean;
  position: number;
}): { ok: true } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'El nombre del método es muy corto.' };
  getDb()
    .prepare(
      `UPDATE payment_methods SET name = ?, description = ?, account_info = ?, instructions = ?,
              is_enabled = ?, position = ?
        WHERE id = ?`,
    )
    .run(
      name,
      input.description.trim(),
      input.accountInfo.trim(),
      input.instructions.trim(),
      input.isEnabled ? 1 : 0,
      input.position,
      input.id,
    );
  return { ok: true };
}

/* ---------------------------- Configuración --------------------------- */

export function saveSettings(entries: Record<string, string>): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
  const now = nowIso();
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(entries)) {
      stmt.run(key, value, now);
    }
  });
  tx();
}

/* ------------------------------ Clientes ----------------------------- */

export function toggleUserActive(id: number): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const user = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(id) as
    | { id: number; role: string; is_active: number }
    | undefined;
  if (!user) return { ok: false, error: 'El usuario no existe.' };
  if (user.role === 'admin') {
    return { ok: false, error: 'No puedes desactivar una cuenta administradora.' };
  }
  db.prepare('UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?').run(
    nowIso(),
    id,
  );
  return { ok: true };
}
