/**
 * Persistencia permanente de NOVASTORE en Supabase.
 *
 * Estrategia:
 *  1. SQLite (better-sqlite3) sigue siendo el motor de consultas: todas las
 *     páginas y acciones existentes funcionan igual, sin reescribir su SQL.
 *  2. Supabase es la copia permanente. Al arrancar el contenedor se restauran
 *     las tablas desde Supabase; si allí están vacías, se sube el contenido
 *     local (siembra inicial del catálogo).
 *  3. Cada escritura (INSERT/UPDATE/DELETE) marca su tabla como pendiente y,
 *     tras un breve retardo, se sincroniza esa tabla completa: se actualizan
 *     las filas y se eliminan en Supabase las que ya no existen en local.
 *
 * Si Supabase no responde, la tienda sigue funcionando con SQLite y se deja
 * constancia en el registro: nunca se rompe una compra por un fallo de red.
 */
import type { Db } from './db';
import { sbDeleteIn, sbPing, sbSelect, sbSyncSequence, sbUpsert, supabaseConfigured } from './supabase-rest';

type Row = Record<string, unknown>;

interface TableSpec {
  name: string;
  pk: string;
  /** Columnas binarias que viajan como bytea (hex `\x…`) en PostgreSQL. */
  blobs?: string[];
}

/** Orden padre → hijo: primero se restauran las tablas de las que dependen otras. */
const TABLES: TableSpec[] = [
  { name: 'users', pk: 'id' },
  { name: 'categories', pk: 'id' },
  { name: 'products', pk: 'id' },
  { name: 'product_variants', pk: 'id' },
  { name: 'offers', pk: 'id' },
  { name: 'carts', pk: 'id' },
  { name: 'cart_items', pk: 'id' },
  { name: 'orders', pk: 'id' },
  { name: 'order_items', pk: 'id' },
  { name: 'payment_proofs', pk: 'id', blobs: ['data'] },
  { name: 'balance_movements', pk: 'id' },
  { name: 'payment_methods', pk: 'id' },
  { name: 'settings', pk: 'key' },
  { name: 'login_attempts', pk: 'key' },
  { name: 'sessions', pk: 'token_hash' },
  { name: 'recharge_requests', pk: 'id', blobs: ['data'] },
  { name: 'support_threads', pk: 'id' },
  { name: 'support_messages', pk: 'id' },
];

const CHUNK = 200;

let ready: Promise<void> | null = null;
let restorePromise: Promise<void> | null = null;
let loggedUnavailable = false;

function isBuilding(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * Los scripts de prueba (npm run test:saldo / test:checkout) trabajan sobre una
 * base SQLite temporal: no deben restaurar ni replicar nada en Supabase.
 */
function syncDisabled(): boolean {
  return process.env.NOVASTORE_DISABLE_SYNC === '1';
}

/* ------------------------------------------------------------------ */
/* Codificación de filas                                              */
/* ------------------------------------------------------------------ */

function encodeValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`;
  if (value instanceof Uint8Array) return `\\x${Buffer.from(value).toString('hex')}`;
  if (typeof value === 'bigint') return Number(value);
  return value;
}

function decodeValue(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('\\x')) {
    return Buffer.from(value.slice(2), 'hex');
  }
  if (typeof value === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0) {
    // Por si el proyecto devuelve bytea en base64.
    return Buffer.from(value, 'base64');
  }
  return value;
}

function encodeRow(spec: TableSpec, row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = encodeValue(value);
  }
  return out;
}

function decodeRow(spec: TableSpec, row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = spec.blobs?.includes(key) ? decodeValue(value) : value;
  }
  return out;
}

/**
 * Claves de `settings` que no se sincronizan con la base local: `media:*`
 * guarda las imágenes subidas desde el panel (binarios que se leen directamente
 * de Supabase). Se excluyen del empuje y del borrado remoto para no eliminarlas
 * al sincronizar el resto de ajustes.
 */
const SKIPPED_SETTINGS_PREFIXES = ['media:'];

function isSkippedKey(spec: TableSpec, key: unknown): boolean {
  if (spec.name !== 'settings') return false;
  const value = String(key ?? '');
  return SKIPPED_SETTINGS_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function localColumns(db: Db, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

/* ------------------------------------------------------------------ */
/* Restauración al arrancar                                           */
/* ------------------------------------------------------------------ */

function upsertLocal(db: Db, spec: TableSpec, rows: Row[]): number {
  if (rows.length === 0) return 0;
  const columns = localColumns(db, spec.name);
  let applied = 0;

  const insertRows = db.transaction((batch: Row[]) => {
    for (const raw of batch) {
      const row = decodeRow(spec, raw);
      const keys = Object.keys(row).filter((key) => columns.includes(key));
      if (keys.length === 0 || !keys.includes(spec.pk)) continue;
      const updates = keys.filter((key) => key !== spec.pk).map((key) => `${key} = excluded.${key}`);
      const sql =
        `INSERT INTO ${spec.name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ` +
        `ON CONFLICT(${spec.pk}) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}`;
      db.prepare(sql).run(...keys.map((key) => row[key] as never));
      applied += 1;
    }
  });

  insertRows(rows);

  if (spec.pk === 'id') {
    const max = db.prepare(`SELECT MAX(id) AS m FROM ${spec.name}`).get() as { m: number | null };
    if (typeof max.m === 'number' && Number.isFinite(max.m)) {
      db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(spec.name);
      db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(spec.name, max.m);
    }
  }
  return applied;
}

/** Sube una tabla local completa y elimina en Supabase lo que ya no existe. */
export async function pushTable(db: Db, spec: TableSpec): Promise<void> {
  const rows = (db.prepare(`SELECT * FROM ${spec.name}`).all() as Row[])
    .map((row) => encodeRow(spec, row))
    .filter((row) => !isSkippedKey(spec, row[spec.pk]));

  for (let index = 0; index < rows.length; index += CHUNK) {
    await sbUpsert(spec.name, rows.slice(index, index + CHUNK), spec.pk);
  }

  const remote = await sbSelect<Row>(spec.name, spec.pk);
  const localKeys = new Set(rows.map((row) => String(row[spec.pk])));
  const stale = remote
    .map((row) => row[spec.pk] as string | number)
    .filter((value) => !localKeys.has(String(value)))
    .filter((value) => !isSkippedKey(spec, value));
  if (stale.length > 0) {
    await sbDeleteIn(spec.name, spec.pk, stale);
  }

  if (spec.pk === 'id') {
    await sbSyncSequence(spec.name, spec.pk);
  }
}

/**
 * Replica en Supabase, de forma inmediata y esperable, las tablas indicadas.
 * Lo usan las copias de seguridad: al restaurar hay que asegurar que Supabase
 * queda con el estado restaurado antes de responder al administrador.
 */
export async function syncTablesNow(db: Db, names: string[]): Promise<void> {
  if (!supabaseConfigured() || isBuilding()) return;
  await persistenceReady();
  for (const name of names) {
    const spec = TABLES.find((item) => item.name === name);
    if (!spec) continue;
    await pushTable(db, spec);
  }
}

async function restoreAll(db: Db): Promise<void> {
  if (!supabaseConfigured()) {
    console.log('[novastore] Supabase sin configurar: se usa solo la base local.');
    return;
  }

  const ping = await sbPing();
  if (!ping.ok) {
    if (!loggedUnavailable) {
      loggedUnavailable = true;
      console.warn(
        `[novastore] Supabase no disponible (${ping.status ?? 'sin respuesta'}: ${ping.error ?? ''}). ` +
          'La tienda sigue funcionando con la base local; revisa la conexión en Settings.',
      );
    }
    return;
  }

  let restored = 0;
  let uploaded = 0;
  for (const spec of TABLES) {
    try {
      const remote = (await sbSelect<Row>(spec.name)).filter(
        (row) => !isSkippedKey(spec, row[spec.pk]),
      );
      if (remote.length === 0) {
        await pushTable(db, spec);
        uploaded += 1;
        continue;
      }
      restored += upsertLocal(db, spec, remote);
    } catch (error) {
      console.warn(
        `[novastore] no se pudo sincronizar la tabla ${spec.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  console.log(
    `[novastore] Supabase conectado: ${restored} filas restauradas, ${uploaded} tablas subidas.`,
  );
}

/** Inicia (una sola vez) la restauración desde Supabase. */
export function ensureRestore(db: Db): Promise<void> {
  if (isBuilding() || syncDisabled()) return Promise.resolve();
  if (!restorePromise) {
    restorePromise = restoreAll(db).catch((error) => {
      console.warn(
        `[novastore] restauración desde Supabase fallida: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
    ready = restorePromise;
  }
  return restorePromise;
}

export function persistenceReady(): Promise<void> {
  return ready ?? Promise.resolve();
}

/* ------------------------------------------------------------------ */
/* Sincronización tras cada escritura                                 */
/* ------------------------------------------------------------------ */

const dirty = new Set<string>();
let flushTimer: NodeJS.Timeout | null = null;
let flushing: Promise<void> | null = null;
let currentDb: Db | null = null;

function writeTarget(sql: string): string | null {
  const match = sql.match(
    /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_]*)/i,
  );
  if (!match) return null;
  const table = match[1];
  return TABLES.some((spec) => spec.name === table) ? table : null;
}

function scheduleFlush(table: string): void {
  if (!supabaseConfigured() || isBuilding()) return;
  dirty.add(table);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void runFlush();
  }, 250);
  // No mantiene el proceso vivo por sí solo.
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

async function runFlush(): Promise<void> {
  if (flushing) return;
  const db = currentDb;
  if (!db) return;
  const tables = [...dirty].sort(
    (a, b) => TABLES.findIndex((spec) => spec.name === a) - TABLES.findIndex((spec) => spec.name === b),
  );
  dirty.clear();
  if (tables.length === 0) return;

  flushing = (async () => {
    await persistenceReady();
    for (const name of tables) {
      const spec = TABLES.find((item) => item.name === name);
      if (!spec) continue;
      try {
        await pushTable(db, spec);
      } catch (error) {
        console.warn(
          `[novastore] no se pudo guardar ${name} en Supabase: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  })().finally(() => {
    flushing = null;
  });

  await flushing;
}

/**
 * Intercepta las escrituras de SQLite para replicarlas en Supabase.
 * Se llama una sola vez al abrir la base de datos.
 */
export function attachPersistence(db: Db): void {
  if (syncDisabled()) return;
  currentDb = db;
  const marker = db as Db & { __novastorePersistence?: boolean };
  if (marker.__novastorePersistence) return;
  marker.__novastorePersistence = true;

  const originalPrepare = db.prepare.bind(db);
  db.prepare = ((source: string) => {
    const statement = originalPrepare(source);
    const table = writeTarget(source);
    if (!table) return statement;

    try {
      const originalRun = statement.run.bind(statement);
      Object.defineProperty(statement, 'run', {
        configurable: true,
        writable: true,
        value: (...args: unknown[]) => {
          const result = originalRun(...(args as never[]));
          scheduleFlush(table);
          return result;
        },
      });
    } catch {
      // Si no se puede interceptar, la tienda sigue funcionando con SQLite.
    }
    return statement;
  }) as Db['prepare'];
}
