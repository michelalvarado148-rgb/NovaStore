/**
 * Acceso a la base de datos de Supabase (PostgreSQL) desde el servidor.
 *
 * La tienda no usa la clave anónima: se conecta con un rol dedicado de base de
 * datos cuyas credenciales viven en las variables de entorno del servidor
 * (SUPABASE_DB_URL). Las tablas tienen RLS activo y ningún permiso para las
 * claves públicas, de modo que solo este servidor puede leer y escribir.
 *
 * Se mantienen las mismas funciones que usaba la capa de persistencia.
 */
import { Pool } from 'pg';

const CONNECTION_STRING = (process.env.SUPABASE_DB_URL || '').trim();

export class SupabaseError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status;
  }
}

export function supabaseConfigured(): boolean {
  return Boolean(CONNECTION_STRING);
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: CONNECTION_STRING,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 12_000,
      application_name: 'novastore',
    });
    pool.on('error', (error) => {
      console.warn('[novastore] error del pool de Supabase:', error.message);
    });
  }
  return pool;
}

function qi(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function qualified(table: string): string {
  return `public.${qi(table)}`;
}

/** Convierte los valores `\x…` de las columnas bytea en Buffer para pg. */
function toParam(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('\\x')) {
    return Buffer.from(value.slice(2), 'hex');
  }
  return value;
}

async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!supabaseConfigured()) {
    throw new SupabaseError(0, 'Supabase no está configurado (falta SUPABASE_DB_URL)');
  }
  try {
    const result = await getPool().query(sql, params);
    return result.rows as T[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SupabaseError(0, message);
  }
}

/** Lee todas las filas de una tabla. */
export async function sbSelect<T = Record<string, unknown>>(
  table: string,
  select = '*',
): Promise<T[]> {
  const columns =
    select.trim() === '*'
      ? '*'
      : select
          .split(',')
          .map((column) => qi(column.trim()))
          .join(', ');
  return query<T>(`select ${columns} from ${qualified(table)}`);
}

/** Inserta o actualiza filas por su clave primaria. */
export async function sbUpsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  if (columns.length === 0) return;

  const params: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = columns.map((column) => {
      params.push(toParam(row[column]));
      return `$${params.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const updates = columns
    .filter((column) => column !== onConflict)
    .map((column) => `${qi(column)} = excluded.${qi(column)}`);
  const conflictClause = updates.length
    ? `do update set ${updates.join(', ')}`
    : 'do nothing';

  await query(
    `insert into ${qualified(table)} (${columns.map(qi).join(', ')}) values ${tuples.join(', ')} ` +
      `on conflict (${qi(onConflict)}) ${conflictClause}`,
    params,
  );
}

/** Borra las filas cuyo valor de `column` esté en la lista. */
export async function sbDeleteIn(
  table: string,
  column: string,
  values: (string | number)[],
): Promise<void> {
  if (values.length === 0) return;
  await query(`delete from ${qualified(table)} where ${qi(column)} = any($1)`, [values]);
}

/** Ajusta la secuencia de una tabla con id autoincremental tras restaurar datos. */
export async function sbSyncSequence(table: string, column = 'id'): Promise<void> {
  const rows = await query<{ max: string | number | null }>(
    `select max(${qi(column)}) as max from ${qualified(table)}`,
  );
  const max = Number(rows[0]?.max ?? 0);
  if (!Number.isFinite(max) || max <= 0) return;
  await query(`select setval(pg_get_serial_sequence($1, $2), $3, true)`, [
    `public.${table}`,
    column,
    max,
  ]);
}

/** Comprueba que la base responde y que las credenciales son válidas. */
export async function sbPing(): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    await query('select 1 as ok');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
