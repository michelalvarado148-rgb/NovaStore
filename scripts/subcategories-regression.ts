/**
 * Regresión de subcategorías por niveles de NOVASTORE.
 * Usa una base temporal: no toca los datos reales de la tienda.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-subcat-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'regression.db');
process.env.NOVASTORE_DISABLE_SYNC = '1';

let checks = 0;
function ok(label: string) {
  checks += 1;
  console.log(`  ✓ ${label}`);
}

async function main() {
  const catalog = await import('../src/lib/catalog');
  const admin = await import('../src/lib/admin');
  const { getDb } = await import('../src/lib/db');

  const juegos = catalog.getCategories().find((category) => category.slug === 'juegos');
  assert.ok(juegos, 'la categoría Juegos debe existir en el catálogo sembrado');
  assert.equal(juegos!.parent_id, null);
  ok('las categorías existentes se mantienen como principales');

  const totalAntes = catalog.getCategories({ includeInactive: true }).length;
  const productosAntes = catalog.getProducts({ limit: 500 }).length;

  /* 1. Crear subcategorías dentro de una categoría principal */
  const freeFire = admin.saveCategory({
    name: 'Free Fire',
    description: 'Diamantes, pases y cuentas de Free Fire',
    imageUrl: null,
    position: 1,
    isActive: true,
    parentId: juegos!.id,
  });
  assert.ok(freeFire.ok, `no se pudo crear la subcategoría: ${freeFire.ok ? '' : freeFire.error}`);
  const freeFireId = freeFire.ok ? freeFire.id : 0;

  const diamantes = admin.saveCategory({
    name: 'Diamantes',
    description: 'Recargas de diamantes',
    imageUrl: null,
    position: 1,
    isActive: true,
    parentId: freeFireId,
  });
  assert.ok(diamantes.ok);
  const diamantesId = diamantes.ok ? diamantes.id : 0;

  const sensibilidades = admin.saveCategory({
    name: 'Sensibilidades',
    description: 'Configuraciones de sensibilidad',
    imageUrl: null,
    position: 2,
    isActive: true,
    parentId: freeFireId,
  });
  assert.ok(sensibilidades.ok);
  const sensibilidadesId = sensibilidades.ok ? sensibilidades.id : 0;
  ok('se crean subcategorías dentro de una categoría principal');

  /* 2. Navegación por niveles */
  assert.deepEqual(
    catalog.getSubcategories(juegos!.id).map((category) => category.slug),
    ['free-fire'],
  );
  const freeFireRow = catalog.getCategoryBySlug('free-fire');
  assert.equal(freeFireRow?.parent_id, juegos!.id);
  assert.deepEqual(
    catalog.getSubcategories(freeFireId).map((category) => category.slug).sort(),
    ['diamantes', 'sensibilidades'],
  );
  assert.ok(!catalog.getRootCategories().some((category) => category.slug === 'free-fire'));
  assert.deepEqual(
    catalog.getCategoryAncestors(catalog.getCategoryBySlug('diamantes')!).map((c) => c.slug),
    ['juegos', 'free-fire'],
  );
  const tree = catalog.getCategoryTree();
  const freeFireIndex = tree.findIndex((category) => category.slug === 'free-fire');
  assert.equal(tree[freeFireIndex].depth, 1);
  assert.equal(tree[freeFireIndex - 1].slug, 'juegos');
  ok('la tienda navega principal → subcategoría → productos');

  /* 3. Solo dos niveles */
  const tercerNivel = admin.saveCategory({
    name: 'Diamantes baratos',
    description: 'No permitido',
    imageUrl: null,
    position: 3,
    isActive: true,
    parentId: diamantesId,
  });
  assert.equal(tercerNivel.ok, false);
  ok('se bloquea un tercer nivel de categorías');

  /* 4. Persistencia de la jerarquía (misma fila que sincroniza Supabase) */
  const stored = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(`cat_parent:${freeFireId}`) as { value: string } | undefined;
  assert.equal(stored?.value, String(juegos!.id));
  const publicSettings = catalog.getSettings();
  assert.ok(!Object.keys(publicSettings).some((key) => key.startsWith('cat_parent:')));
  ok('la jerarquía se guarda en la base de datos y no se filtra al escaparate');

  /* 5. Asignar y mover productos sin duplicarlos */
  const product = admin.saveProduct({
    name: 'Diamantes Free Fire 100',
    description: 'Paquete de prueba',
    categoryId: diamantesId,
    imageUrl: null,
    priceCents: 1500,
    comparePriceCents: null,
    stock: 10,
    isActive: true,
    variants: [],
  } as never);
  assert.ok(product.ok, `no se pudo crear el producto: ${product.ok ? '' : product.error}`);
  const productId = product.ok ? product.id : 0;

  assert.deepEqual(
    catalog.getProducts({ categorySlug: 'diamantes' }).map((item) => item.id),
    [productId],
  );
  assert.equal(catalog.getProducts({ categorySlug: 'sensibilidades' }).length, 0);

  const moved = admin.moveProductsToCategory({
    productIds: [productId],
    targetCategoryId: sensibilidadesId,
  });
  assert.deepEqual(moved, { ok: true, moved: 1 });
  assert.equal(catalog.getProducts({ categorySlug: 'diamantes' }).length, 0);
  assert.deepEqual(
    catalog.getProducts({ categorySlug: 'sensibilidades' }).map((item) => item.id),
    [productId],
  );
  const duplicated = getDb()
    .prepare('SELECT COUNT(*) AS total FROM products WHERE name = ?')
    .get('Diamantes Free Fire 100') as { total: number };
  assert.equal(duplicated.total, 1);
  ok('los productos se asignan y se mueven entre subcategorías sin duplicarse');

  /* 6. Eliminar subcategorías con protección */
  assert.equal(admin.deleteCategory(freeFireId).ok, false);
  assert.equal(admin.deleteCategory(sensibilidadesId).ok, false);
  const vacia = admin.saveCategory({
    name: 'Otros productos',
    description: 'Subcategoría vacía',
    imageUrl: null,
    position: 4,
    isActive: true,
    parentId: freeFireId,
  });
  assert.ok(vacia.ok);
  const vaciaId = vacia.ok ? vacia.id : 0;
  assert.equal(admin.deleteCategory(vaciaId).ok, true);
  const orphan = getDb()
    .prepare('SELECT COUNT(*) AS total FROM settings WHERE key = ?')
    .get(`cat_parent:${vaciaId}`) as { total: number };
  assert.equal(orphan.total, 0);
  ok('se elimina una subcategoría vacía y se protegen las que tienen contenido');

  /* 7. Una principal con subcategorías no puede volverse subcategoría */
  const convertir = admin.saveCategory({
    id: juegos!.id,
    name: 'Juegos',
    description: juegos!.description,
    imageUrl: juegos!.image_url,
    position: juegos!.position,
    isActive: true,
    parentId: freeFireId,
  });
  assert.equal(convertir.ok, false);
  ok('se evita un ciclo de categorías');

  /* 8. Nada existente se perdió */
  const totalDespues = catalog.getCategories({ includeInactive: true }).length;
  const productosDespues = catalog.getProducts({ limit: 500 }).length;
  assert.equal(totalDespues, totalAntes + 3);
  assert.equal(productosDespues, productosAntes + 1);
  ok('no se borraron categorías ni productos existentes');

  console.log(`\nSubcategorías: ${checks} comprobaciones OK`);
}

main().catch((error) => {
  console.error('\n✗ Regresión de subcategorías falló:', error instanceof Error ? error.message : error);
  process.exit(1);
});
