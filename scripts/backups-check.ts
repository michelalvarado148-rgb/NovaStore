/**
 * Verificación funcional de las copias de seguridad de NOVASTORE.
 *
 * Se ejecuta sobre una COPIA temporal de la base (DATABASE_PATH apunta a
 * /tmp/nb-test.db) y sin Supabase, para no tocar los datos reales.
 *
 * Uso:
 *   tsx scripts/backups-check.ts          # flujo completo
 *   tsx scripts/backups-check.ts rehidratar  # simula un contenedor nuevo
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  createBackup,
  deleteBackup,
  getBackupSettings,
  importBackup,
  listBackups,
  maybeRunAutomaticBackup,
  prepareBackups,
  readBackupJson,
  restoreBackup,
  saveBackupSettings,
} from '../src/lib/backups';
import { getDb } from '../src/lib/db';
import { getSettings } from '../src/lib/catalog';

const ok: string[] = [];
const fail: string[] = [];

function check(label: string, condition: boolean, detail = '') {
  if (condition) ok.push(label);
  else fail.push(`${label}${detail ? ` (${detail})` : ''}`);
}

const db = getDb();

function counts() {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    products: one('SELECT COUNT(*) AS n FROM products'),
    categories: one('SELECT COUNT(*) AS n FROM categories'),
    users: one('SELECT COUNT(*) AS n FROM users'),
    orders: one('SELECT COUNT(*) AS n FROM orders'),
  };
}

async function main() {
  const phase = process.argv[2] ?? 'completo';

  if (phase === 'rehidratar') {
    // Simula un contenedor nuevo: se vacía el historial local y debe
    // recuperarse desde el espejo guardado en `settings` (Supabase).
    const mirrored = db
      .prepare("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'backup:row:%'")
      .get() as { n: number };
    db.prepare('DELETE FROM backups').run();
    const afterDelete = listBackups(db).length;

    await prepareBackups(db);
    const recovered = listBackups(db);

    check('el espejo en settings conserva las copias', mirrored.n > 0, `filas=${mirrored.n}`);
    check('el historial local quedó vacío tras simular reinicio', afterDelete === 0);
    check(
      'el historial se recupera desde Supabase al arrancar',
      recovered.length === mirrored.n,
      `${recovered.length}/${mirrored.n}`,
    );
    check(
      'las copias recuperadas conservan nombre y checksum',
      recovered.every((b) => Boolean(b.name) && (b.checksum ?? '').length === 64),
    );
    return;
  }

  await prepareBackups(db);

  // Punto de partida limpio de copias (sólo en la base temporal).
  db.prepare('DELETE FROM backups').run();
  db.prepare("DELETE FROM settings WHERE key LIKE 'backup:%'").run();

  const start = counts();

  /* 1. Crear copia manual */
  const created = await createBackup({ kind: 'manual', name: 'Copia de prueba', createdBy: 1 });
  check('crear copia manual', created.ok, created.ok ? '' : created.error);
  if (!created.ok) return;
  const id = created.backup.id;
  check('la copia queda completa', created.backup.status === 'completa', created.backup.status);
  check('la copia tiene tamaño', created.backup.size_bytes > 0, `${created.backup.size_bytes} B`);
  check('la copia tiene checksum', (created.backup.checksum ?? '').length === 64);

  /* 2. Historial */
  const list = listBackups(db);
  check('aparece en el historial', list.some((b) => b.id === id));
  check('el historial trae tipo manual', list.find((b) => b.id === id)?.kind === 'manual');

  /* 3. Descargar (JSON verificado) */
  const exported = readBackupJson(id);
  check('descargar JSON', exported.ok, exported.ok ? '' : exported.error);
  let jsonText = '';
  if (exported.ok) {
    jsonText = exported.json;
    const parsed = JSON.parse(jsonText) as {
      format?: string;
      tables?: Record<string, unknown[]>;
    };
    check('el JSON declara el formato', parsed.format === 'novastore-backup', String(parsed.format));
    const tables = parsed.tables ?? {};
    check(
      'incluye productos, categorías, usuarios y pedidos',
      ['products', 'categories', 'users', 'orders'].every((t) => Array.isArray(tables[t])),
      Object.keys(tables).length + ' tablas',
    );
    check(
      'incluye las configuraciones de la tienda',
      Array.isArray(tables.settings) && (tables.settings as unknown[]).length > 0,
    );
    check(
      'el nombre de archivo es .json',
      exported.fileName.endsWith('.json'),
      exported.fileName,
    );
  }

  /* 4. Pérdida de datos simulada */
  const victimProducts = db
    .prepare('SELECT id FROM products ORDER BY id DESC LIMIT 3')
    .all() as { id: number }[];
  for (const row of victimProducts) db.prepare('DELETE FROM products WHERE id = ?').run(row.id);
  db.prepare('DELETE FROM categories WHERE id = (SELECT MAX(id) FROM categories)').run();
  const damaged = counts();
  check('se simula el borrado de datos', damaged.products < start.products, `${damaged.products}/${start.products}`);

  /* 5. Restaurar */
  const restored = await restoreBackup(id, 1);
  check('restaurar la copia', restored.ok, restored.ok ? '' : restored.error);
  const after = counts();
  check('los productos vuelven', after.products === start.products, `${after.products}/${start.products}`);
  check('las categorías vuelven', after.categories === start.categories, `${after.categories}/${start.categories}`);
  check('los usuarios siguen intactos', after.users === start.users, `${after.users}/${start.users}`);
  check('los pedidos siguen intactos', after.orders === start.orders, `${after.orders}/${start.orders}`);

  const dupProducts = db
    .prepare('SELECT COUNT(*) AS n FROM products')
    .get() as { n: number };
  const distinctProducts = db
    .prepare('SELECT COUNT(DISTINCT id) AS n FROM products')
    .get() as { n: number };
  check(
    'no se duplican registros al restaurar',
    dupProducts.n === distinctProducts.n,
    `${dupProducts.n} filas / ${distinctProducts.n} ids`,
  );
  check(
    'se creó una copia de seguridad previa al restaurar',
    listBackups(db).length >= 2,
    `${listBackups(db).length} copias`,
  );
  check(
    'la copia previa se marca como automática',
    listBackups(db).some((b) => b.kind === 'automatica'),
  );

  /* 6. Importar el JSON descargado */
  if (jsonText) {
    const imported = await importBackup(jsonText, 1);
    check('importar JSON descargado', imported.ok, imported.ok ? '' : imported.error);
    if (imported.ok) {
      check('la copia importada queda registrada', imported.backup.kind === 'importada');
      const del = await deleteBackup(imported.backup.id);
      check('eliminar copia', del.ok, del.ok ? '' : del.error);
      check('la copia eliminada ya no aparece', !listBackups(db).some((b) => b.id === imported.backup.id));
    }
  }

  /* 7. Copias automáticas */
  saveBackupSettings({ enabled: true, frequency: 'diaria' });
  check('activar automáticas diarias', getBackupSettings(db).enabled && getBackupSettings(db).frequency === 'diaria');

  const auto1 = await maybeRunAutomaticBackup(db);
  check('se ejecuta la copia automática vencida', auto1.ran, auto1.reason ?? '');
  check('queda registrada la última copia', Boolean(getBackupSettings(db).lastBackupAt));

  const auto2 = await maybeRunAutomaticBackup(db);
  check('no repite la copia antes del intervalo', auto2.ran === false, auto2.reason ?? '');

  saveBackupSettings({ enabled: true, frequency: 'semanal' });
  check('cambiar a semanal', getBackupSettings(db).frequency === 'semanal');
  saveBackupSettings({ enabled: false, frequency: 'diaria' });
  const auto3 = await maybeRunAutomaticBackup(db);
  check('desactivar detiene las automáticas', auto3.ran === false, auto3.reason ?? '');

  /* 8. Espejo en Supabase (tabla settings) */
  const mirrored = db
    .prepare("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'backup:%'")
    .get() as { n: number };
  check('las copias se espejan en settings (Supabase)', mirrored.n > 0, `${mirrored.n} claves`);

  const storeSettings = getSettings();
  check(
    'los ajustes internos no se mezclan con los de la tienda',
    Object.keys(storeSettings).every((key) => !key.startsWith('backup:')),
    `${Object.keys(storeSettings).length} ajustes visibles`,
  );
}

main()
  .catch((error) => {
    fail.push(`excepción: ${error instanceof Error ? error.message : String(error)}`);
  })
  .finally(() => {
    console.log('\n--- RESULTADO ---');
    for (const item of ok) console.log(`OK   ${item}`);
    for (const item of fail) console.log(`FALLA ${item}`);
    console.log(`\n${ok.length} correctas, ${fail.length} fallidas`);
    process.exit(fail.length === 0 ? 0 : 1);
  });
