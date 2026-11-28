/**
 * Comprueba que la restauración desde Supabase reemplaza las filas locales que
 * chocan por clave única (por ejemplo las categorías sembradas al crear el
 * contenedor, que tienen el mismo slug con otro id) en lugar de abortar con
 * «UNIQUE constraint failed» y dejar la tienda sin sus datos.
 */
import fs from 'node:fs';

process.env.DATABASE_PATH = '/tmp/nc-restore-conflict.db';
process.env.NOVASTORE_DISABLE_SYNC = '1';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`OK   ${label}`);
  } else {
    failures += 1;
    console.log(`FALLA ${label}${detail ? ` → ${detail}` : ''}`);
  }
}

type Row = Record<string, unknown>;

async function main(): Promise<void> {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${process.env.DATABASE_PATH}${suffix}`, { force: true });
  }

  const { getDb } = await import('../src/lib/db');
  const { TABLES, upsertLocal, dropOrphans } = await import('../src/lib/persistence');

  const db = getDb();
  const categories = TABLES.find((spec) => spec.name === 'categories');
  const products = TABLES.find((spec) => spec.name === 'products');
  if (!categories || !products) throw new Error('No se encontraron las tablas del catálogo');

  /* ---------- Categorías: mismo slug/nombre, id remoto distinto ---------- */
  const localCategories = db.prepare('SELECT * FROM categories ORDER BY id').all() as Row[];
  check('hay categorías sembradas en la base local', localCategories.length > 0);

  const remoteCategories = localCategories.map((row, index) => ({ ...row, id: 900 + index }));
  const appliedCategories = upsertLocal(db, categories, remoteCategories);
  check(
    'se restauran todas las categorías remotas',
    appliedCategories === remoteCategories.length,
    `${appliedCategories}/${remoteCategories.length}`,
  );

  const afterCategories = db
    .prepare('SELECT id, slug, name FROM categories ORDER BY id')
    .all() as { id: number; slug: string; name: string }[];
  check(
    'los ids remotos sustituyen a los locales',
    afterCategories.length === remoteCategories.length && afterCategories.every((row) => row.id >= 900),
    afterCategories.map((row) => row.id).join(','),
  );
  check(
    'no quedan slugs duplicados',
    new Set(afterCategories.map((row) => row.slug)).size === afterCategories.length,
  );
  check(
    'no quedan nombres duplicados',
    new Set(afterCategories.map((row) => row.name)).size === afterCategories.length,
  );

  /* ---------- Productos: slug repetido y categoría remota ---------- */
  const localProducts = db.prepare('SELECT * FROM products ORDER BY id').all() as Row[];
  check('hay productos sembrados en la base local', localProducts.length > 0);

  const remoteProducts = localProducts.map((row, index) => ({
    ...row,
    id: 800 + index,
    category_id: 900,
  }));
  const appliedProducts = upsertLocal(db, products, remoteProducts);
  check(
    'se restauran todos los productos remotos',
    appliedProducts === remoteProducts.length,
    `${appliedProducts}/${remoteProducts.length}`,
  );

  const afterProducts = db
    .prepare('SELECT id, category_id, slug FROM products ORDER BY id')
    .all() as { id: number; category_id: number | null; slug: string }[];
  check(
    'los productos apuntan a la categoría restaurada',
    afterProducts.length === remoteProducts.length && afterProducts.every((row) => row.category_id === 900),
  );
  check(
    'no quedan slugs de producto duplicados',
    new Set(afterProducts.map((row) => row.slug)).size === afterProducts.length,
  );

  /* ---------- Segunda pasada: restaurar dos veces no duplica ---------- */
  upsertLocal(db, categories, remoteCategories);
  upsertLocal(db, products, remoteProducts);
  const categoriesAgain = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number };
  const productsAgain = db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number };
  check('restaurar dos veces no duplica categorías', categoriesAgain.n === remoteCategories.length);
  check('restaurar dos veces no duplica productos', productsAgain.n === remoteProducts.length);

  /* ---------- Filas huérfanas: no rompen la réplica de variantes/ofertas ---------- */
  const variants = TABLES.find((spec) => spec.name === 'product_variants');
  if (!variants) throw new Error('No se encontró la tabla product_variants');
  const validProduct = db.prepare('SELECT id FROM products LIMIT 1').get() as { id: number } | undefined;
  check('hay un producto válido de referencia', Boolean(validProduct));
  const batch = [
    { id: 1, product_id: validProduct?.id ?? 0, name: 'variante válida' },
    { id: 2, product_id: 999_999, name: 'variante huérfana' },
  ];
  const kept = dropOrphans(db, variants, batch);
  check('se omite la variante cuyo producto ya no existe', kept.length === 1 && kept[0].id === 1);
  check('se conserva la variante válida', kept[0]?.product_id === validProduct?.id);

  console.log(`\n${failures === 0 ? 'TODO OK' : `${failures} fallo(s)`}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
