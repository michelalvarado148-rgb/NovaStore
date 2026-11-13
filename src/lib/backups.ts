/**
 * Copias de seguridad de NOVASTORE.
 *
 * Cada copia guarda el contenido completo de las tablas de la tienda en un JSON
 * (comprimido con gzip y codificado en base64). El historial se guarda en la
 * tabla local `backups` y se espeja en la tabla `settings` de Supabase con el
 * prefijo reservado `backup:`, que ya está replicada. Los
 * comprobantes de pago viajan dentro de la copia como datos binarios, así que no
 * hace falta un bucket externo para no perderlos.
 *
 * Garantías:
 *  - Toda copia se verifica al guardarse (se vuelve a leer y se compara su
 *    SHA-256) y queda con estado "completa" o "error".
 *  - Restaurar exige una copia previa del estado actual, creada automáticamente.
 *  - Restaurar vacía cada tabla y vuelve a insertar las filas con su id original:
 *    nunca se duplican registros.
 *  - Las sesiones y los intentos de acceso no se copian ni se restauran: son
 *    datos efímeros y devolver sesiones antiguas abriría un agujero de seguridad.
 */
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import type { Db } from './db';
import { ensureAdmin, getDb, nowIso } from './db';
import { persistenceReady, syncTablesNow } from './persistence';

type Row = Record<string, unknown>;

export const BACKUP_FORMAT = 'novastore-backup';
export const BACKUP_VERSION = 1;

/** Prefijos reservados en `settings` para el historial de copias en Supabase. */
const MIRROR_PREFIX = 'backup:row:';
const AUTO_PREFIX = 'backup:auto:';

/** Tablas que se guardan en cada copia, en orden padre → hijo. */
export const BACKUP_TABLES = [
  'users',
  'categories',
  'products',
  'product_variants',
  'offers',
  'carts',
  'cart_items',
  'orders',
  'order_items',
  'payment_proofs',
  'balance_movements',
  'payment_methods',
  'settings',
  'recharge_requests',
  'support_threads',
  'support_messages',
] as const;

/** Columnas binarias: se codifican en base64 dentro del JSON. */
const BLOB_COLUMNS: Record<string, string[]> = {
  payment_proofs: ['data'],
  recharge_requests: ['data'],
};

export type BackupKind = 'manual' | 'automatica' | 'importada';
export type BackupStatus = 'completa' | 'incompleta' | 'error';

export type BackupSummary = {
  id: number;
  name: string;
  kind: BackupKind;
  status: BackupStatus;
  size_bytes: number;
  rows_count: number;
  tables_count: number;
  checksum: string;
  origin: string | null;
  note: string | null;
  created_by: number | null;
  created_at: string;
};

export type BackupSettings = {
  enabled: boolean;
  frequency: 'diaria' | 'semanal';
  lastRunAt: string | null;
  lastBackupAt: string | null;
};

export type BackupSnapshot = {
  format: string;
  version: number;
  store: string;
  created_at: string;
  counts: Record<string, number>;
  tables: Record<string, Row[]>;
};

export const KIND_LABELS: Record<BackupKind, string> = {
  manual: 'Manual',
  automatica: 'Automática',
  importada: 'Importada',
};

export const STATUS_LABELS: Record<BackupStatus, string> = {
  completa: 'Completa',
  incompleta: 'Incompleta',
  error: 'Error',
};

const SUMMARY_COLUMNS =
  'id, name, kind, status, size_bytes, rows_count, tables_count, checksum, origin, note, created_by, created_at';

/* ------------------------------------------------------------------ */
/* Serialización                                                      */
/* ------------------------------------------------------------------ */

function encodeValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return { $blob: value.toString('base64') };
  if (value instanceof Uint8Array) return { $blob: Buffer.from(value).toString('base64') };
  if (typeof value === 'bigint') return Number(value);
  return value;
}

function decodeValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && '$blob' in (value as Row)) {
    return Buffer.from(String((value as Row).$blob ?? ''), 'base64');
  }
  return value;
}

function localColumns(db: Db, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name);
}

/** Lee todas las tablas de la tienda y devuelve la instantánea. */
export function buildSnapshot(db: Db): BackupSnapshot {
  const tables: Record<string, Row[]> = {};
  const counts: Record<string, number> = {};

  for (const name of BACKUP_TABLES) {
    // Las copias guardadas viven en `settings` con prefijo reservado: nunca se
    // incluyen dentro de otra copia ni se pierden al restaurar.
    const query =
      name === 'settings'
        ? `SELECT * FROM settings WHERE key NOT LIKE '${MIRROR_PREFIX}%'`
        : `SELECT * FROM ${name}`;
    const rows = db.prepare(query).all() as Row[];
    const blobs = BLOB_COLUMNS[name] ?? [];
    tables[name] = rows.map((row) => {
      const encoded: Row = {};
      for (const [key, value] of Object.entries(row)) {
        encoded[key] = blobs.includes(key) ? encodeValue(value) : value;
      }
      return encoded;
    });
    counts[name] = rows.length;
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    store: 'NOVASTORE',
    created_at: nowIso(),
    counts,
    tables,
  };
}

function serialize(snapshot: BackupSnapshot) {
  const json = JSON.stringify(snapshot);
  const checksum = crypto.createHash('sha256').update(json).digest('hex');
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 }).toString('base64');
  return { json, checksum, compressed, size: Buffer.byteLength(json, 'utf8') };
}

function decompress(payload: string): string {
  return zlib.gunzipSync(Buffer.from(payload, 'base64')).toString('utf8');
}

function checksumOf(json: string): string {
  return crypto.createHash('sha256').update(json).digest('hex');
}

function defaultName(kind: BackupKind, date: Date): string {
  const stamp = date
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ')
    .replace(/-/g, '/');
  if (kind === 'automatica') return `Copia automática ${stamp}`;
  if (kind === 'importada') return `Copia importada ${stamp}`;
  return `Copia manual ${stamp}`;
}

/* ------------------------------------------------------------------ */
/* Espejo en Supabase (tabla settings)                                */
/* ------------------------------------------------------------------ */

function upsertSetting(db: Db, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, nowIso());
}

/**
 * Copia el historial local a la tabla `settings`, que sí está replicada en
 * Supabase. Así las copias sobreviven a los despliegues y a la pérdida del
 * contenedor sin necesitar tablas nuevas ni permisos de administrador.
 */
function mirrorToSettings(db: Db): void {
  const keep = new Set<string>();

  const rows = db.prepare('SELECT * FROM backups').all() as Row[];
  for (const row of rows) {
    const key = `${MIRROR_PREFIX}${row.id}`;
    keep.add(key);
    upsertSetting(db, key, JSON.stringify(row));
  }

  const settingsRows = db.prepare('SELECT key, value FROM backup_settings').all() as {
    key: string;
    value: string;
  }[];
  for (const row of settingsRows) {
    const key = `${AUTO_PREFIX}${row.key}`;
    keep.add(key);
    upsertSetting(db, key, row.value);
  }

  const existing = db
    .prepare(
      `SELECT key FROM settings WHERE key LIKE '${MIRROR_PREFIX}%' OR key LIKE '${AUTO_PREFIX}%'`,
    )
    .all() as { key: string }[];
  const remove = db.prepare('DELETE FROM settings WHERE key = ?');
  for (const row of existing) {
    if (!keep.has(row.key)) remove.run(row.key);
  }
}

/** Reconstruye el historial local desde Supabase (contenedor nuevo). */
function hydrateFromSettings(db: Db): void {
  const local = db.prepare('SELECT COUNT(*) AS total FROM backups').get() as { total: number };
  if (local.total > 0) return;

  const rows = db
    .prepare(`SELECT key, value FROM settings WHERE key LIKE '${MIRROR_PREFIX}%'`)
    .all() as { key: string; value: string }[];

  const insert = db.prepare(
    `INSERT OR REPLACE INTO backups
      (id, name, kind, status, size_bytes, rows_count, tables_count, checksum, origin, note, payload, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const row of rows) {
    try {
      const data = JSON.parse(row.value) as Row;
      insert.run(
        Number(data.id),
        String(data.name),
        String(data.kind ?? 'manual'),
        String(data.status ?? 'completa'),
        Number(data.size_bytes ?? 0),
        Number(data.rows_count ?? 0),
        Number(data.tables_count ?? 0),
        String(data.checksum ?? ''),
        (data.origin ?? null) as string | null,
        (data.note ?? null) as string | null,
        String(data.payload ?? ''),
        (data.created_by ?? null) as number | null,
        String(data.created_at ?? nowIso()),
      );
    } catch {
      // Una fila ilegible no debe impedir recuperar el resto del historial.
    }
  }

  const auto = db
    .prepare(`SELECT key, value FROM settings WHERE key LIKE '${AUTO_PREFIX}%'`)
    .all() as { key: string; value: string }[];
  for (const row of auto) {
    setBackupSetting(db, row.key.slice(AUTO_PREFIX.length), row.value);
  }
}

let prepared = false;

/** Deja el historial listo (recuperado de Supabase) antes de leerlo o escribirlo. */
export async function prepareBackups(db: Db = getDb()): Promise<void> {
  if (prepared) return;
  try {
    await persistenceReady();
  } catch {
    // Sin Supabase se trabaja con el historial local.
  }
  try {
    hydrateFromSettings(db);
  } catch (error) {
    console.warn(
      '[novastore] no se pudo recuperar el historial de copias:',
      error instanceof Error ? error.message : String(error),
    );
  }
  prepared = true;
}

/** Guarda el historial local en Supabase de forma inmediata. */
export async function flushBackups(db: Db = getDb()): Promise<void> {
  try {
    mirrorToSettings(db);
  } catch (error) {
    console.warn(
      '[novastore] no se pudo espejar el historial de copias:',
      error instanceof Error ? error.message : String(error),
    );
    return;
  }
  try {
    await syncTablesNow(db, ['settings']);
  } catch (error) {
    console.warn(
      `[novastore] el historial de copias no se pudo replicar en Supabase: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Crear                                                              */
/* ------------------------------------------------------------------ */

export type CreateBackupOptions = {
  kind?: BackupKind;
  name?: string;
  note?: string | null;
  origin?: string | null;
  createdBy?: number | null;
};

export async function createBackup(
  options: CreateBackupOptions = {},
): Promise<{ ok: true; backup: BackupSummary } | { ok: false; error: string }> {
  const db = getDb();
  await prepareBackups(db);
  const kind: BackupKind = options.kind ?? 'manual';

  let snapshot: BackupSnapshot;
  try {
    snapshot = buildSnapshot(db);
  } catch (error) {
    return {
      ok: false,
      error: `No se pudo leer la base de datos: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const { checksum, compressed, size } = serialize(snapshot);
  const rowsCount = Object.values(snapshot.counts).reduce((total, value) => total + value, 0);
  const tablesCount = Object.values(snapshot.counts).filter((value) => value > 0).length;
  const createdAt = nowIso();
  const name = (options.name?.trim() || defaultName(kind, new Date())).slice(0, 120);

  const info = db
    .prepare(
      `INSERT INTO backups
        (name, kind, status, size_bytes, rows_count, tables_count, checksum, origin, note, payload, created_by, created_at)
       VALUES (?, ?, 'incompleta', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      name,
      kind,
      size,
      rowsCount,
      tablesCount,
      checksum,
      options.origin ?? 'panel',
      options.note ?? null,
      compressed,
      options.createdBy ?? null,
      createdAt,
    );

  const id = Number(info.lastInsertRowid);

  // Verificación real: se relee lo guardado, se descomprime y se compara el hash.
  const stored = db.prepare('SELECT payload, checksum FROM backups WHERE id = ?').get(id) as
    | { payload: string; checksum: string }
    | undefined;

  let verified = false;
  if (stored) {
    try {
      verified = checksumOf(decompress(stored.payload)) === stored.checksum;
    } catch {
      verified = false;
    }
  }

  db.prepare('UPDATE backups SET status = ? WHERE id = ?').run(verified ? 'completa' : 'error', id);

  if (!verified) {
    return { ok: false, error: 'La copia se guardó incompleta: no pasó la verificación de integridad.' };
  }

  setBackupSetting(db, 'last_backup_at', createdAt);

  await flushBackups(db);

  const backup = getBackup(db, id);
  if (!backup) return { ok: false, error: 'La copia no se pudo leer después de guardarla.' };
  return { ok: true, backup };
}

/* ------------------------------------------------------------------ */
/* Consultar                                                          */
/* ------------------------------------------------------------------ */

export function getBackup(db: Db, id: number): BackupSummary | null {
  const row = db
    .prepare(`SELECT ${SUMMARY_COLUMNS} FROM backups WHERE id = ?`)
    .get(id) as BackupSummary | undefined;
  return row ?? null;
}

export function listBackups(db: Db = getDb(), limit = 200): BackupSummary[] {
  return db
    .prepare(`SELECT ${SUMMARY_COLUMNS} FROM backups ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as BackupSummary[];
}

export function countBackups(db: Db = getDb()): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM backups').get() as { total: number };
  return row.total;
}

/** Devuelve el JSON descargable de una copia (ya verificado). */
export function readBackupJson(
  id: number,
): { ok: true; json: string; fileName: string } | { ok: false; error: string } {
  const db = getDb();
  const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as
    | (BackupSummary & { payload: string })
    | undefined;
  if (!row) return { ok: false, error: 'La copia no existe.' };

  let json: string;
  try {
    json = decompress(row.payload);
  } catch {
    return { ok: false, error: 'El archivo de la copia está dañado.' };
  }
  if (checksumOf(json) !== row.checksum) {
    return { ok: false, error: 'La copia no pasó la verificación de integridad.' };
  }

  const stamp = row.created_at.replace(/[:.]/g, '-');
  return { ok: true, json, fileName: `novastore-copia-${stamp}.json` };
}

/* ------------------------------------------------------------------ */
/* Restaurar                                                          */
/* ------------------------------------------------------------------ */

export type RestoreResult =
  | { ok: true; rows: number; tables: number; safety: string }
  | { ok: false; error: string };

export async function restoreBackup(id: number, adminId: number | null): Promise<RestoreResult> {
  const db = getDb();
  await prepareBackups(db);
  const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as
    | (BackupSummary & { payload: string })
    | undefined;
  if (!row) return { ok: false, error: 'La copia seleccionada no existe.' };

  let json: string;
  try {
    json = decompress(row.payload);
  } catch {
    return { ok: false, error: 'El archivo de la copia está dañado y no se puede restaurar.' };
  }
  if (checksumOf(json) !== row.checksum) {
    return { ok: false, error: 'La copia no pasó la verificación de integridad; no se cambió nada.' };
  }

  let snapshot: BackupSnapshot;
  try {
    snapshot = JSON.parse(json) as BackupSnapshot;
  } catch {
    return { ok: false, error: 'El contenido de la copia no es un JSON válido.' };
  }
  if (snapshot.format !== BACKUP_FORMAT || !snapshot.tables) {
    return { ok: false, error: 'El contenido no tiene el formato de copia de NOVASTORE.' };
  }

  // 1. Copia de seguridad del estado actual, obligatoria antes de restaurar.
  const safety = await createBackup({
    kind: 'automatica',
    name: `Antes de restaurar «${row.name}»`.slice(0, 120),
    note: 'Copia automática del estado actual creada antes de restaurar.',
    origin: 'pre-restauracion',
    createdBy: adminId,
  });
  if (!safety.ok) {
    return {
      ok: false,
      error: `No se restauró nada: no se pudo crear la copia previa del estado actual (${safety.error}).`,
    };
  }

  // 2. Reemplazo completo: se vacía cada tabla y se insertan las filas originales.
  let restored = 0;
  try {
    const apply = db.transaction(() => {
      // Hijos primero para respetar las claves foráneas (orders → users, etc.).
      for (const name of [...BACKUP_TABLES].reverse()) {
        // En `settings` se conservan las copias guardadas (prefijo reservado).
        if (name === 'settings') {
          db.prepare(`DELETE FROM settings WHERE key NOT LIKE '${MIRROR_PREFIX}%'`).run();
          continue;
        }
        db.prepare(`DELETE FROM ${name}`).run();
      }
      for (const name of BACKUP_TABLES) {
        const rows = snapshot.tables[name] ?? [];
        if (rows.length === 0) continue;
        const columns = localColumns(db, name);
        const blobs = BLOB_COLUMNS[name] ?? [];
        for (const raw of rows) {
          const values: Row = {};
          for (const [key, value] of Object.entries(raw)) {
            if (!columns.includes(key)) continue;
            values[key] = blobs.includes(key) ? decodeValue(value) : value;
          }
          const keys = Object.keys(values);
          if (keys.length === 0) continue;
          db.prepare(
            `INSERT INTO ${name} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          ).run(...keys.map((key) => values[key] as never));
          restored += 1;
        }
      }
    });
    apply();
  } catch (error) {
    return {
      ok: false,
      error: `La restauración falló y se revirtió: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  // 3. Nunca dejar la tienda sin administrador (la copia puede ser anterior a él).
  try {
    ensureAdmin(db);
  } catch (error) {
    console.warn(
      '[novastore] no se pudo verificar el administrador después de restaurar:',
      error instanceof Error ? error.message : String(error),
    );
  }

  // 4. Replicar el estado restaurado en Supabase.
  try {
    await syncTablesNow(db, [...BACKUP_TABLES]);
  } catch (error) {
    console.warn(
      `[novastore] restauración local aplicada, pero no se pudo replicar en Supabase: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const tables = Object.values(snapshot.counts ?? {}).filter((value) => value > 0).length;
  return { ok: true, rows: restored, tables, safety: safety.backup.name };
}

/* ------------------------------------------------------------------ */
/* Importar y eliminar                                                */
/* ------------------------------------------------------------------ */

export type ImportResult =
  | { ok: true; backup: BackupSummary }
  | { ok: false; error: string };

export async function importBackup(text: string, adminId: number | null): Promise<ImportResult> {
  const db = getDb();
  await prepareBackups(db);
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: 'El archivo está vacío.' };

  let snapshot: BackupSnapshot;
  try {
    snapshot = JSON.parse(trimmed) as BackupSnapshot;
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  if (!snapshot || snapshot.format !== BACKUP_FORMAT || !snapshot.tables) {
    return { ok: false, error: 'El archivo no es una copia de seguridad de NOVASTORE.' };
  }

  const counts: Record<string, number> = {};
  for (const name of BACKUP_TABLES) {
    counts[name] = Array.isArray(snapshot.tables[name]) ? snapshot.tables[name].length : 0;
  }
  const normalized: BackupSnapshot = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    store: snapshot.store ?? 'NOVASTORE',
    created_at: snapshot.created_at ?? nowIso(),
    counts,
    tables: snapshot.tables,
  };

  const { checksum, compressed, size } = serialize(normalized);
  const rowsCount = Object.values(counts).reduce((total, value) => total + value, 0);
  const tablesCount = Object.values(counts).filter((value) => value > 0).length;
  const createdAt = nowIso();
  const originDate = String(normalized.created_at).slice(0, 16).replace('T', ' ');
  const name = `Copia importada ${originDate}`.slice(0, 120);

  const info = db
    .prepare(
      `INSERT INTO backups
        (name, kind, status, size_bytes, rows_count, tables_count, checksum, origin, note, payload, created_by, created_at)
       VALUES (?, 'importada', 'incompleta', ?, ?, ?, ?, 'archivo', ?, ?, ?, ?)`,
    )
    .run(
      name,
      size,
      rowsCount,
      tablesCount,
      checksum,
      `Importada desde un archivo JSON con ${rowsCount} registros.`,
      compressed,
      adminId,
      createdAt,
    );

  const id = Number(info.lastInsertRowid);
  const stored = db.prepare('SELECT payload, checksum FROM backups WHERE id = ?').get(id) as
    | { payload: string; checksum: string }
    | undefined;
  const verified = stored ? checksumOf(decompress(stored.payload)) === stored.checksum : false;
  db.prepare('UPDATE backups SET status = ? WHERE id = ?').run(verified ? 'completa' : 'error', id);
  if (!verified) return { ok: false, error: 'La copia importada no pasó la verificación.' };

  await flushBackups(db);

  const backup = getBackup(db, id);
  if (!backup) return { ok: false, error: 'La copia importada no se pudo leer.' };
  return { ok: true, backup };
}

export async function deleteBackup(id: number): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  await prepareBackups(db);
  const row = getBackup(db, id);
  if (!row) return { ok: false, error: 'La copia no existe.' };

  db.prepare('DELETE FROM backups WHERE id = ?').run(id);

  await flushBackups(db);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Copias automáticas                                                 */
/* ------------------------------------------------------------------ */

const SETTINGS_KEYS = {
  enabled: 'auto_enabled',
  frequency: 'auto_frequency',
  lastRun: 'last_auto_run_at',
  lastBackup: 'last_backup_at',
} as const;

function readSettings(db: Db): Map<string, string> {
  const rows = db.prepare('SELECT key, value FROM backup_settings').all() as {
    key: string;
    value: string;
  }[];
  return new Map(rows.map((row) => [row.key, row.value]));
}

function setBackupSetting(db: Db, key: string, value: string): void {
  db.prepare(
    `INSERT INTO backup_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, nowIso());
}

export function getBackupSettings(db: Db = getDb()): BackupSettings {
  const values = readSettings(db);
  const frequency = values.get(SETTINGS_KEYS.frequency) === 'semanal' ? 'semanal' : 'diaria';
  return {
    enabled: values.get(SETTINGS_KEYS.enabled) === '1',
    frequency,
    lastRunAt: values.get(SETTINGS_KEYS.lastRun) ?? null,
    lastBackupAt: values.get(SETTINGS_KEYS.lastBackup) ?? null,
  };
}

export function saveBackupSettings(
  input: { enabled: boolean; frequency: 'diaria' | 'semanal' },
  db: Db = getDb(),
): void {
  setBackupSetting(db, SETTINGS_KEYS.enabled, input.enabled ? '1' : '0');
  setBackupSetting(db, SETTINGS_KEYS.frequency, input.frequency === 'semanal' ? 'semanal' : 'diaria');
}

let autoRunning = false;

/**
 * Crea una copia automática si ya venció el intervalo configurado.
 * Se llama al entrar al panel y desde un temporizador del servidor.
 */
export async function maybeRunAutomaticBackup(
  db: Db = getDb(),
): Promise<{ ran: boolean; reason?: string; backup?: BackupSummary }> {
  if (autoRunning) return { ran: false, reason: 'Ya hay una copia automática en curso.' };

  const settings = getBackupSettings(db);
  if (!settings.enabled) return { ran: false, reason: 'Las copias automáticas están desactivadas.' };

  const intervalMs =
    settings.frequency === 'semanal' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const last = settings.lastRunAt ? Date.parse(settings.lastRunAt) : NaN;
  const now = Date.now();
  if (Number.isFinite(last) && now - last < intervalMs) {
    return { ran: false, reason: 'Todavía no corresponde la siguiente copia automática.' };
  }

  autoRunning = true;
  try {
    const result = await createBackup({
      kind: 'automatica',
      name: defaultName('automatica', new Date()),
      note: `Respaldo automático ${settings.frequency}.`,
      origin: 'automatica',
    });
    if (!result.ok) return { ran: false, reason: result.error };

    setBackupSetting(db, SETTINGS_KEYS.lastRun, nowIso());
    await flushBackups(db);
    return { ran: true, backup: result.backup };
  } finally {
    autoRunning = false;
  }
}
