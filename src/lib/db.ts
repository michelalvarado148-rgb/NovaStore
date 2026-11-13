import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

export type Db = Database.Database;

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'novastore.db');

/**
 * Contraseña del administrador cuando no se define ADMIN_PASSWORD.
 * Vive aquí para que el sembrado y el aviso del panel usen el mismo valor.
 */
export const DEFAULT_ADMIN_PASSWORD = 'NovaStore2026!';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  compare_price_cents INTEGER,
  stock INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sold_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER,
  stock INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique
  ON cart_items(cart_id, product_id, IFNULL(variant_id, 0));

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'en_proceso', 'entregado', 'rechazado', 'cancelado')),
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (payment_status IN ('pendiente', 'verificado', 'rechazado')),
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  customer_note TEXT,
  admin_note TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proofs_order ON payment_proofs(order_id);

CREATE TABLE IF NOT EXISTS balance_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recarga', 'compra', 'reembolso', 'ajuste')),
  description TEXT NOT NULL DEFAULT '',
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_user ON balance_movements(user_id);

CREATE TABLE IF NOT EXISTS recharge_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  method TEXT NOT NULL,
  reference TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  admin_note TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  data BLOB,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recharge_user ON recharge_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_status ON recharge_requests(status);

CREATE TABLE IF NOT EXISTS support_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT 'Consulta de soporte',
  status TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'cerrado')),
  last_message_at TEXT NOT NULL,
  last_message_by TEXT,
  admin_unread INTEGER NOT NULL DEFAULT 0,
  user_unread INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'admin')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages(thread_id);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  account_info TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function nowIso(): string {
  return new Date().toISOString();
}

export function newToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function openDb(): Db {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  seed(db);
  return db;
}

/** Ajustes para bases de datos creadas con versiones anteriores del esquema. */
function migrate(db: Db) {
  const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'updated_at')) {
    db.exec("ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.some((column) => column.name === 'address')) {
    db.exec('ALTER TABLE users ADD COLUMN address TEXT');
  }
  db.exec("UPDATE users SET updated_at = created_at WHERE updated_at = '' OR updated_at IS NULL");
}

declare global {
  var __novaStoreDb: Db | undefined;
}

export function getDb(): Db {
  if (!global.__novaStoreDb) {
    global.__novaStoreDb = openDb();
  }
  return global.__novaStoreDb;
}

/* ------------------------------------------------------------------ */
/* Seed                                                               */
/* ------------------------------------------------------------------ */

const DEFAULT_SETTINGS: Record<string, string> = {
  store_name: 'NOVASTORE',
  store_tagline: 'Tu tienda de productos digitales en Perú',
  hero_badge: 'Entrega inmediata 24/7',
  hero_title: 'Productos digitales al instante, con la confianza de NOVASTORE',
  hero_subtitle:
    'Gift cards, streaming, aplicaciones, redes sociales y números virtuales. Compra en soles, sube tu comprobante y recibe tu producto al ser verificado.',
  telegram_url: 'https://t.me/novastore',
  contact_email: 'soporte@novastore.pe',
  contact_phone: '+51 987 654 321',
  contact_hours: 'Lunes a domingo · 8:00 a 23:00 (hora Perú)',
  announcement:
    'Atención personalizada por Telegram · Verificamos cada comprobante antes de entregar',
  footer_note:
    'NOVASTORE es una tienda independiente de productos digitales. No estamos afiliados a las marcas mencionadas.',
  order_prefix: 'NV',
};

const DEFAULT_PAYMENT_METHODS = [
  {
    code: 'yape',
    name: 'Yape',
    description: 'Transferencia inmediata desde tu aplicación Yape.',
    account_info: '987 654 321',
    instructions:
      'Realiza el yape al número indicado y adjunta la captura del comprobante. El pedido queda pendiente hasta que el administrador lo verifique.',
    position: 1,
  },
  {
    code: 'plin',
    name: 'Plin',
    description: 'Pago por Plin desde cualquier banco afiliado.',
    account_info: '987 654 321',
    instructions:
      'Envía el plin al número indicado y adjunta la imagen del comprobante para su verificación.',
    position: 2,
  },
  {
    code: 'tarjeta',
    name: 'Tarjeta bancaria',
    description: 'Transferencia o link de pago con tarjeta.',
    account_info: 'BCP · 193-0000000-0-00 · NOVASTORE',
    instructions:
      'Realiza la transferencia o solicita el link de pago por Telegram y adjunta el comprobante.',
    position: 3,
  },
  {
    code: 'saldo',
    name: 'Saldo NOVASTORE',
    description: 'Usa el saldo a favor de tu cuenta.',
    account_info: 'Saldo a favor en tu cuenta',
    instructions:
      'El saldo se descuenta al confirmar el pedido. El pedido queda pendiente hasta la verificación del administrador.',
    position: 4,
  },
];

type SeedCategory = {
  name: string;
  slug: string;
  description: string;
  image: string;
  position: number;
};

const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: 'Juegos',
    slug: 'juegos',
    description: 'Gift cards, monedas y cuentas para tus juegos favoritos.',
    image: '/images/categories/juegos.svg',
    position: 1,
  },
  {
    name: 'Streaming',
    slug: 'streaming',
    description: 'Series, películas y música sin interrupciones.',
    image: '/images/categories/streaming.svg',
    position: 2,
  },
  {
    name: 'Aplicaciones',
    slug: 'aplicaciones',
    description: 'Licencias y planes premium para trabajar y crear.',
    image: '/images/categories/aplicaciones.svg',
    position: 3,
  },
  {
    name: 'Redes sociales',
    slug: 'redes-sociales',
    description: 'Impulsa tus perfiles con seguidores y visualizaciones.',
    image: '/images/categories/redes-sociales.svg',
    position: 4,
  },
  {
    name: 'Números virtuales',
    slug: 'numeros-virtuales',
    description: 'Verificaciones y recepción de SMS al instante.',
    image: '/images/categories/numeros-virtuales.svg',
    position: 5,
  },
  {
    name: 'Otros productos digitales',
    slug: 'otros',
    description: 'Licencias, combos y sorpresas digitales.',
    image: '/images/categories/otros.svg',
    position: 6,
  },
];

type SeedVariant = { name: string; price: number | null; stock: number | null };
type SeedProduct = {
  category: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare?: number;
  stock: number | null;
  featured?: boolean;
  image: string;
  variants?: SeedVariant[];
};

const SEED_PRODUCTS: SeedProduct[] = [
  {
    category: 'juegos',
    name: 'Gift Card Steam',
    slug: 'gift-card-steam',
    description:
      'Recarga tu cartera de Steam y compra juegos, DLC y contenido adicional. Código original enviado por Telegram luego de verificar tu pago.',
    price: 3500,
    compare: 4500,
    stock: 30,
    featured: true,
    image: '/images/products/gift-card-steam.svg',
    variants: [
      { name: '10 USD', price: 3500, stock: 12 },
      { name: '20 USD', price: 6800, stock: 10 },
      { name: '50 USD', price: 16500, stock: 8 },
    ],
  },
  {
    category: 'juegos',
    name: 'Gift Card PlayStation Network',
    slug: 'gift-card-playstation-network',
    description:
      'Saldo para PlayStation Store disponible en cuentas de región USA. Ideal para juegos, suscripciones y contenido extra.',
    price: 4500,
    compare: 5500,
    stock: 20,
    featured: true,
    image: '/images/products/gift-card-playstation-network.svg',
    variants: [
      { name: '10 USD', price: 4500, stock: 8 },
      { name: '25 USD', price: 11000, stock: 7 },
      { name: '50 USD', price: 21500, stock: 5 },
    ],
  },
  {
    category: 'juegos',
    name: 'Robux para Roblox',
    slug: 'robux-roblox',
    description:
      'Robux entregados por método seguro a tu cuenta de Roblox. Entrega promedio de 15 a 60 minutos tras la verificación.',
    price: 2000,
    stock: null,
    image: '/images/products/robux-roblox.svg',
    variants: [
      { name: '400 Robux', price: 2000, stock: null },
      { name: '800 Robux', price: 3800, stock: null },
      { name: '1700 Robux', price: 7500, stock: null },
    ],
  },
  {
    category: 'juegos',
    name: 'V-Bucks Fortnite',
    slug: 'v-bucks-fortnite',
    description:
      'Moneda oficial de Fortnite para comprar pases de batalla y aspectos. Recarga segura con asesoría por Telegram.',
    price: 2500,
    stock: 15,
    image: '/images/products/v-bucks-fortnite.svg',
  },
  {
    category: 'streaming',
    name: 'Netflix Premium 4K',
    slug: 'netflix-premium-4k',
    description:
      'Perfil privado con calidad 4K UHD y audio espacial. Incluye garantía durante todo el periodo contratado.',
    price: 1500,
    compare: 2500,
    stock: null,
    featured: true,
    image: '/images/products/netflix-premium-4k.svg',
    variants: [
      { name: '1 mes', price: 1500, stock: null },
      { name: '3 meses', price: 4000, stock: null },
      { name: '6 meses', price: 7500, stock: null },
    ],
  },
  {
    category: 'streaming',
    name: 'Disney+ Premium',
    slug: 'disney-plus-premium',
    description:
      'Acceso a Disney+, Star y ESPN con calidad 4K. Perfil individual y soporte durante toda la suscripción.',
    price: 1200,
    compare: 1800,
    stock: 40,
    featured: true,
    image: '/images/products/disney-plus-premium.svg',
  },
  {
    category: 'streaming',
    name: 'Spotify Premium',
    slug: 'spotify-premium',
    description:
      'Música sin anuncios, descargas offline y calidad muy alta. Activación en tu propia cuenta.',
    price: 1000,
    stock: null,
    image: '/images/products/spotify-premium.svg',
    variants: [
      { name: '1 mes', price: 1000, stock: null },
      { name: '3 meses', price: 2500, stock: null },
      { name: '6 meses', price: 4500, stock: null },
    ],
  },
  {
    category: 'streaming',
    name: 'HBO Max',
    slug: 'hbo-max',
    description:
      'Estrenos de Warner, DC y HBO en un solo lugar. Perfil con calidad Full HD y soporte inmediato.',
    price: 1200,
    stock: 25,
    image: '/images/products/hbo-max.svg',
  },
  {
    category: 'aplicaciones',
    name: 'Canva Pro',
    slug: 'canva-pro',
    description:
      'Diseña sin límites con plantillas premium, borrado de fondo y 1 TB de almacenamiento. Activación en tu cuenta.',
    price: 2000,
    compare: 3500,
    stock: null,
    featured: true,
    image: '/images/products/canva-pro.svg',
    variants: [
      { name: '1 mes', price: 2000, stock: null },
      { name: '12 meses', price: 9000, stock: null },
    ],
  },
  {
    category: 'aplicaciones',
    name: 'Microsoft 365',
    slug: 'microsoft-365',
    description:
      'Word, Excel, PowerPoint y 1 TB en OneDrive para tu cuenta personal. Licencia anual con soporte.',
    price: 4000,
    stock: 20,
    image: '/images/products/microsoft-365.svg',
    variants: [{ name: '1 año', price: 4000, stock: 20 }],
  },
  {
    category: 'aplicaciones',
    name: 'CapCut Pro',
    slug: 'capcut-pro',
    description:
      'Edición de video profesional sin marca de agua, con efectos y plantillas premium desbloqueadas.',
    price: 1500,
    stock: null,
    image: '/images/products/capcut-pro.svg',
  },
  {
    category: 'aplicaciones',
    name: 'ChatGPT Plus',
    slug: 'chatgpt-plus',
    description:
      'Acceso a los modelos más avanzados, respuestas prioritarias y herramientas de análisis. Configuración asistida.',
    price: 3500,
    compare: 4500,
    stock: 10,
    featured: true,
    image: '/images/products/chatgpt-plus.svg',
  },
  {
    category: 'redes-sociales',
    name: 'Seguidores Instagram',
    slug: 'seguidores-instagram',
    description:
      'Seguidores de alta calidad con entrega gradual para mantener la naturalidad de tu perfil.',
    price: 1500,
    stock: null,
    image: '/images/products/seguidores-instagram.svg',
    variants: [
      { name: '1 000 seguidores', price: 1500, stock: null },
      { name: '5 000 seguidores', price: 6500, stock: null },
      { name: '10 000 seguidores', price: 12000, stock: null },
    ],
  },
  {
    category: 'redes-sociales',
    name: 'Seguidores TikTok',
    slug: 'seguidores-tiktok',
    description:
      'Impulsa tu cuenta de TikTok con seguidores reales y visualizaciones constantes.',
    price: 2000,
    stock: null,
    image: '/images/products/seguidores-tiktok.svg',
  },
  {
    category: 'numeros-virtuales',
    name: 'Número virtual WhatsApp',
    slug: 'numero-virtual-whatsapp',
    description:
      'Número temporal para verificar WhatsApp y otras aplicaciones. Recepción de SMS en minutos.',
    price: 1200,
    stock: 50,
    featured: true,
    image: '/images/products/numero-virtual-whatsapp.svg',
  },
  {
    category: 'numeros-virtuales',
    name: 'Número virtual para SMS',
    slug: 'numero-virtual-sms',
    description:
      'Recibe códigos de verificación internacionales con números de distintos países.',
    price: 1500,
    stock: 50,
    image: '/images/products/numero-virtual-sms.svg',
  },
  {
    category: 'otros',
    name: 'Licencia Windows 11 Pro',
    slug: 'licencia-windows-11-pro',
    description:
      'Clave de activación original y permanente para Windows 11 Pro. Incluye guía de instalación.',
    price: 4500,
    compare: 6000,
    stock: 12,
    featured: true,
    image: '/images/products/licencia-windows-11-pro.svg',
  },
  {
    category: 'otros',
    name: 'Combo Digital Sorpresa',
    slug: 'combo-digital-sorpresa',
    description:
      'Una selección de productos digitales con descuento. Ideal para probar la experiencia NOVASTORE.',
    price: 1000,
    stock: null,
    image: '/images/products/combo-digital-sorpresa.svg',
  },
];

function seed(db: Db) {
  const now = nowIso();

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
  );
  const settingsTx = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(key, value, now);
    }
  });
  settingsTx();

  const insertMethod = db.prepare(
    `INSERT OR IGNORE INTO payment_methods
      (code, name, description, account_info, instructions, is_enabled, position)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  );
  const methodTx = db.transaction(() => {
    for (const m of DEFAULT_PAYMENT_METHODS) {
      insertMethod.run(m.code, m.name, m.description, m.account_info, m.instructions, m.position);
    }
  });
  methodTx();

  const categoryCount = db
    .prepare('SELECT COUNT(*) AS total FROM categories')
    .get() as { total: number };

  if (categoryCount.total === 0) {
    const insertCategory = db.prepare(
      `INSERT INTO categories (name, slug, description, image_url, position, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    );
    const insertProduct = db.prepare(
      `INSERT INTO products
        (category_id, name, slug, description, image_url, price_cents, compare_price_cents,
         stock, is_active, is_featured, sold_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    );
    const insertVariant = db.prepare(
      `INSERT INTO product_variants (product_id, name, price_cents, stock, position, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
    );

    const catalogTx = db.transaction(() => {
      const idBySlug = new Map<string, number>();
      for (const c of SEED_CATEGORIES) {
        const info = insertCategory.run(
          c.name,
          c.slug,
          c.description,
          c.image,
          c.position,
          now,
        );
        idBySlug.set(c.slug, Number(info.lastInsertRowid));
      }
      for (const p of SEED_PRODUCTS) {
        const categoryId = idBySlug.get(p.category) ?? null;
        const info = insertProduct.run(
          categoryId,
          p.name,
          p.slug,
          p.description,
          p.image,
          p.price,
          p.compare ?? null,
          p.stock,
          p.featured ? 1 : 0,
          Math.floor(Math.random() * 40) + 5,
          now,
          now,
        );
        const productId = Number(info.lastInsertRowid);
        (p.variants ?? []).forEach((v, index) => {
          insertVariant.run(productId, v.name, v.price, v.stock, index);
        });
      }
    });
    catalogTx();
  }

  const offerCount = db.prepare('SELECT COUNT(*) AS total FROM offers').get() as {
    total: number;
  };
  if (offerCount.total === 0) {
    const cat = (slug: string) =>
      (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as
        | { id: number }
        | undefined)?.id ?? null;
    db.prepare(
      `INSERT INTO offers (title, description, product_id, category_id, discount_percent,
        starts_at, ends_at, is_active, created_at)
       VALUES (?, ?, NULL, ?, ?, NULL, NULL, 1, ?)`,
    ).run(
      'Semana de streaming',
      'Descuento especial en todas las plataformas de streaming.',
      cat('streaming'),
      15,
      now,
    );
    const steam = db
      .prepare("SELECT id FROM products WHERE slug = 'gift-card-steam'")
      .get() as { id: number } | undefined;
    if (steam) {
      db.prepare(
        `INSERT INTO offers (title, description, product_id, category_id, discount_percent,
          starts_at, ends_at, is_active, created_at)
         VALUES (?, ?, ?, NULL, ?, NULL, NULL, 1, ?)`,
      ).run(
        'Steam con 10% menos',
        'Solo por tiempo limitado en la gift card de Steam.',
        steam.id,
        10,
        now,
      );
    }
  }

  ensureAdmin(db);
}

/**
 * Crea el administrador o lo sincroniza con ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * Reglas, en este orden:
 *  1. Si ADMIN_PASSWORD está definido, las variables de entorno son la fuente de
 *     verdad: se crea el administrador o se actualizan su correo y contraseña.
 *     Así el acceso al panel no depende de lo que quedó guardado en una base
 *     anterior (la base SQLite vive en el contenedor y se recrea al desplegar).
 *  2. Si no hay variables de entorno y no existe administrador, se crea con el
 *     valor por defecto del código; el panel avisa de que hay que cambiarlo.
 *  3. Si ya existe un administrador y no hay variables de entorno, su contraseña
 *     no se toca: puede haberla cambiado el propio dueño de la tienda.
 *
 * Nunca escribe la contraseña en el registro; solo deja constancia de qué regla
 * se aplicó, para poder diagnosticar el acceso al panel desde los logs.
 */
export function ensureAdmin(db: Db) {
  const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD || '';
  const email = envEmail || 'admin@novastore.pe';
  const now = nowIso();

  const existing = db
    .prepare("SELECT id, email, password_hash FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
    .get() as { id: number; email: string; password_hash: string } | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO users (name, email, password_hash, phone, role, balance_cents, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', 0, 1, ?, ?)`,
    ).run(
      'Administrador NOVASTORE',
      email,
      hashPassword(envPassword || DEFAULT_ADMIN_PASSWORD),
      (process.env.ADMIN_PHONE || '').trim() || null,
      now,
      now,
    );
    console.log(
      `[novastore] administrador creado (${email}); contraseña: ${
        envPassword ? 'definida en ADMIN_PASSWORD' : 'valor por defecto del código'
      }`,
    );
    return;
  }

  if (envPassword) {
    // Un correo que ya pertenece a otra cuenta impediría el UPDATE (email UNIQUE).
    const taken = db
      .prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
      .get(email, existing.id) as { id: number } | undefined;
    const targetEmail = taken ? existing.email : email;

    db.prepare(
      "UPDATE users SET email = ?, password_hash = ?, role = 'admin', is_active = 1, updated_at = ? WHERE id = ?",
    ).run(targetEmail, hashPassword(envPassword), now, existing.id);

    console.log(
      `[novastore] administrador sincronizado con las variables de entorno (${targetEmail})` +
        (taken ? `; ${email} ya pertenece a otra cuenta, se conservó el correo anterior` : ''),
    );
    return;
  }

  const keepsDefault = verifyPassword(DEFAULT_ADMIN_PASSWORD, existing.password_hash);
  console.log(
    `[novastore] administrador existente (${existing.email}); contraseña por defecto vigente: ${
      keepsDefault ? 'sí' : 'no'
    }`,
  );
}

/* ------------------------------------------------------------------ */
/* Password helpers (scrypt, sin dependencias nativas externas)        */
/* ------------------------------------------------------------------ */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const expected = Buffer.from(hash, 'hex');
  const candidate = crypto.scryptSync(password, salt, 64);
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
