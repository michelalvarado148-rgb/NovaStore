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
  product_count?: number;
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
  // Las copias de seguridad se guardan en esta tabla con el prefijo `backup:`;
  // se excluyen para que el escaparate no cargue sus payloads.
  const rows = getDb()
    .prepare("SELECT key, value FROM settings WHERE key NOT LIKE 'backup:%'")
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
  return db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p
                     WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
         FROM categories c ${where}
        ORDER BY c.position ASC, c.name ASC`,
    )
    .all() as Category[];
}

export function getCategoryBySlug(slug: string): Category | null {
  return (getDb().prepare('SELECT * FROM categories WHERE slug = ?').get(slug) as
    | Category
    | undefined) ?? null;
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
