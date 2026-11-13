import { getDb } from './db';
import { nowIso } from './db';

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  position: number;
  is_active: number;
  created_at: string;
  /** Categoría principal a la que pertenece (null = categoría principal). */
  parent_id: number | null;
  product_count?: number;
  /** Nivel dentro del árbol: 0 = principal, 1 = subcategoría. */
  depth?: number;
};

export type Product = {
  id: number;
  category_id: number | null;
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
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  category_slug?: string | null;
};

export type Variant = {
  id: number;
  product_id: number;
  name: string;
  price_cents: number | null;
  stock: number | null;
  position: number;
  is_active: number;
};

export type Offer = {
  id: number;
  title: string;
  description: string;
  product_id: number | null;
  category_id: number | null;
  discount_percent: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  created_at: string;
};

export type PaymentMethod = {
  id: number;
  code: string;
  name: string;
  description: string;
  account_info: string;
  instructions: string;
  is_enabled: number;
  position: number;
};

export type Pricing = {
  priceCents: number;
  comparePriceCents: number | null;
  discountPercent: number;
  offerTitle: string | null;
};

export function getSettings(): Record<string, string> {
  // Las copias de seguridad se guardan en esta tabla con el prefijo `backup:` y
  // las imágenes subidas con el prefijo `media:` y las claves de las notificaciones
  // push con el prefijo `push:`; se excluyen para que el escaparate no cargue
  // sus payloads ni las claves privadas.
  const rows = getDb()
    .prepare(
      "SELECT key, value FROM settings WHERE key NOT LIKE 'backup:%' AND key NOT LIKE 'media:%' AND key NOT LIKE 'push:%' AND key NOT LIKE 'cat_parent:%'",
    )
    .all() as {
    key: string;
    value: string;
  }[];
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export function getSetting(key: string, fallback = ''): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, nowIso());
}

export function getCategories(options?: { includeInactive?: boolean }): Category[] {
  const db = getDb();
  const where = options?.includeInactive ? '' : 'WHERE c.is_active = 1';
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p
                     WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
         FROM categories c ${where}
        ORDER BY c.position ASC, c.name ASC`,
    )
    .all() as Category[];
  return attachParents(rows);
}

/**
 * La jerarquía de categorías se guarda en la tabla `settings` de Supabase
 * (clave `cat_parent:<id>` → id de la categoría principal) porque la conexión
 * de la tienda no tiene permisos para alterar la tabla `categories`.
 * Esas claves se sincronizan con la base remota igual que el resto.
 */
export const CATEGORY_PARENT_PREFIX = 'cat_parent:';

export function getCategoryParentMap(): Record<number, number> {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'cat_parent:%'")
    .all() as { key: string; value: string }[];
  const map: Record<number, number> = {};
  for (const row of rows) {
    const childId = Number(row.key.slice(CATEGORY_PARENT_PREFIX.length));
    const parentId = Number(row.value);
    if (
      Number.isInteger(childId) &&
      childId > 0 &&
      Number.isInteger(parentId) &&
      parentId > 0 &&
      childId !== parentId
    ) {
      map[childId] = parentId;
    }
  }
  return map;
}

function attachParents(rows: Category[]): Category[] {
  const parents = getCategoryParentMap();
  return rows.map((row) => ({ ...row, parent_id: parents[row.id] ?? null }));
}

export function setCategoryParent(categoryId: number, parentId: number | null): void {
  if (parentId === null) {
    clearCategoryParent(categoryId);
    return;
  }
  setSetting(`${CATEGORY_PARENT_PREFIX}${categoryId}`, String(parentId));
}

export function clearCategoryParent(categoryId: number): void {
  getDb()
    .prepare('DELETE FROM settings WHERE key = ?')
    .run(`${CATEGORY_PARENT_PREFIX}${categoryId}`);
}

/** Categorías principales (nivel 1). */
export function getRootCategories(options?: { includeInactive?: boolean }): Category[] {
  return getCategories(options).filter((category) => category.parent_id === null);
}

/** Subcategorías directas de una categoría principal. */
export function getSubcategories(
  parentId: number,
  options?: { includeInactive?: boolean },
): Category[] {
  return getCategories(options).filter((category) => category.parent_id === parentId);
}

/** Árbol aplanado: cada principal seguida de sus subcategorías, con su nivel. */
export function getCategoryTree(options?: { includeInactive?: boolean }): Category[] {
  const all = getCategories(options);
  const childrenOf = new Map<number, Category[]>();
  for (const category of all) {
    if (category.parent_id === null) continue;
    const list = childrenOf.get(category.parent_id) ?? [];
    list.push(category);
    childrenOf.set(category.parent_id, list);
  }

  const ordered: Category[] = [];
  for (const root of all.filter((category) => category.parent_id === null)) {
    ordered.push({ ...root, depth: 0 });
    for (const child of childrenOf.get(root.id) ?? []) {
      ordered.push({ ...child, depth: 1 });
    }
  }

  // Subcategorías cuyo padre ya no existe se muestran como principales.
  const shown = new Set(ordered.map((category) => category.id));
  for (const category of all) {
    if (!shown.has(category.id)) ordered.push({ ...category, depth: 0 });
  }
  return ordered;
}

/** Camino desde la categoría principal hasta el padre de la indicada. */
export function getCategoryAncestors(category: Category): Category[] {
  if (category.parent_id === null) return [];
  const all = getCategories({ includeInactive: true });
  const parent = all.find((item) => item.id === category.parent_id);
  if (!parent) return [];
  return [...getCategoryAncestors(parent), parent];
}

/** Identificadores de todas las subcategorías que dependen de una categoría. */
export function getCategoryDescendantIds(categoryId: number): number[] {
  const all = getCategories({ includeInactive: true });
  const found: number[] = [];
  const walk = (id: number) => {
    for (const category of all) {
      if (category.parent_id === id && !found.includes(category.id)) {
        found.push(category.id);
        walk(category.id);
      }
    }
  };
  walk(categoryId);
  return found;
}

export function getCategoryBySlug(slug: string): Category | null {
  const row = getDb().prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as
    | Category
    | undefined;
  if (!row) return null;
  return attachParents([row])[0];
}

export function getActiveOffers(): Offer[] {
  const now = nowIso();
  return getDb()
    .prepare(
      `SELECT * FROM offers
        WHERE is_active = 1
          AND (starts_at IS NULL OR starts_at <= ?)
          AND (ends_at IS NULL OR ends_at >= ?)
        ORDER BY discount_percent DESC`,
    )
    .all(now, now) as Offer[];
}

export function computePricing(
  product: Pick<Product, 'id' | 'category_id' | 'price_cents' | 'compare_price_cents'>,
  offers: Offer[],
): Pricing {
  let best = 0;
  let title: string | null = null;
  for (const offer of offers) {
    const matchesProduct = offer.product_id !== null && offer.product_id === product.id;
    const matchesCategory =
      offer.product_id === null &&
      offer.category_id !== null &&
      offer.category_id === product.category_id;
    if ((matchesProduct || matchesCategory) && offer.discount_percent > best) {
      best = offer.discount_percent;
      title = offer.title;
    }
  }

  if (best <= 0) {
    return {
      priceCents: product.price_cents,
      comparePriceCents: product.compare_price_cents,
      discountPercent: 0,
      offerTitle: null,
    };
  }

  const discounted = Math.max(1, Math.round((product.price_cents * (100 - best)) / 100));
  return {
    priceCents: discounted,
    comparePriceCents: product.price_cents,
    discountPercent: best,
    offerTitle: title,
  };
}

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
`;

export type ProductQuery = {
  search?: string;
  categorySlug?: string;
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'popular';
  onlyOffers?: boolean;
  featuredOnly?: boolean;
  limit?: number;
  includeInactive?: boolean;
};

export function getProducts(query: ProductQuery = {}): Product[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (!query.includeInactive) clauses.push('p.is_active = 1');
  if (query.featuredOnly) clauses.push('p.is_featured = 1');
  if (query.categorySlug) {
    clauses.push('c.slug = ?');
    params.push(query.categorySlug);
  }
  if (query.search) {
    const term = `%${query.search.trim().toLowerCase()}%`;
    clauses.push('(lower(p.name) LIKE ? OR lower(p.description) LIKE ?)');
    params.push(term, term);
  }

  let orderBy = 'p.is_featured DESC, p.sold_count DESC, p.id DESC';
  if (query.sort === 'recent') orderBy = 'p.id DESC';
  if (query.sort === 'price_asc') orderBy = 'p.price_cents ASC';
  if (query.sort === 'price_desc') orderBy = 'p.price_cents DESC';
  if (query.sort === 'popular') orderBy = 'p.sold_count DESC';

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = query.limit ? `LIMIT ${Math.max(1, Math.floor(query.limit))}` : '';

  let rows = db
    .prepare(`${PRODUCT_SELECT} ${where} ORDER BY ${orderBy} ${limit}`)
    .all(...params) as Product[];

  if (query.onlyOffers) {
    const offers = getActiveOffers();
    const offeredProductIds = new Set<number>();
    const offeredCategoryIds = new Set<number>();
    for (const offer of offers) {
      if (offer.product_id) offeredProductIds.add(offer.product_id);
      if (offer.product_id === null && offer.category_id) offeredCategoryIds.add(offer.category_id);
    }
    rows = rows.filter(
      (row) =>
        offeredProductIds.has(row.id) ||
        (row.category_id !== null && offeredCategoryIds.has(row.category_id)),
    );
  }

  return rows;
}

export function getProductBySlug(slug: string): Product | null {
  return (
    (getDb().prepare(`${PRODUCT_SELECT} WHERE p.slug = ?`).get(slug) as Product | undefined) ?? null
  );
}

export function getProductById(id: number): Product | null {
  return (getDb().prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id) as Product | undefined) ?? null;
}

export function getVariants(productId: number, includeInactive = false): Variant[] {
  const where = includeInactive ? '' : 'AND is_active = 1';
  return getDb()
    .prepare(
      `SELECT * FROM product_variants WHERE product_id = ? ${where} ORDER BY position ASC, id ASC`,
    )
    .all(productId) as Variant[];
}

export function getPaymentMethods(onlyEnabled = true): PaymentMethod[] {
  const where = onlyEnabled ? 'WHERE is_enabled = 1' : '';
  return getDb()
    .prepare(`SELECT * FROM payment_methods ${where} ORDER BY position ASC, id ASC`)
    .all() as PaymentMethod[];
}

export type RecentPurchase = {
  order_number: string;
  created_at: string;
  buyer: string;
  product_name: string;
  quantity: number;
};

export function getRecentPurchases(limit = 6): RecentPurchase[] {
  const rows = getDb()
    .prepare(
      `SELECT o.order_number, o.created_at, u.name AS buyer,
              oi.product_name, oi.quantity
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status IN ('pendiente', 'en_proceso', 'entregado')
        ORDER BY o.id DESC, oi.id ASC
        LIMIT ?`,
    )
    .all(Math.max(1, limit)) as RecentPurchase[];
  return rows;
}

export function getRelatedProducts(categoryId: number | null, excludeId: number, limit = 4): Product[] {
  if (!categoryId) return [];
  return getDb()
    .prepare(
      `${PRODUCT_SELECT} WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1
       ORDER BY p.sold_count DESC LIMIT ?`,
    )
    .all(categoryId, excludeId, Math.max(1, limit)) as Product[];
}

export function stockAvailable(product: Product, variant?: Variant | null): number | null {
  if (variant) {
    if (variant.stock !== null) return variant.stock;
    return product.stock;
  }
  return product.stock;
}
