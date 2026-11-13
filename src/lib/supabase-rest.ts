/**
 * Cliente mínimo de la API REST de Supabase (PostgREST) para el servidor.
 *
 * - Solo se usa en el servidor: la clave viaja en las variables de entorno del
 *   contenedor y nunca se envía al navegador.
 * - No añade dependencias: usa fetch nativo con tiempos de espera cortos para
 *   que una caída de red no bloquee la tienda.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

export class SupabaseError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status;
  }
}

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function sbFetch(path: string, init: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  if (!supabaseConfigured()) {
    throw new SupabaseError(0, 'Supabase no está configurado');
  }
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SupabaseError(response.status, body.slice(0, 300) || response.statusText);
  }
  return response;
}

/** Lee todas las filas de una tabla, paginando para superar el límite de 1000. */
export async function sbSelect<T = Record<string, unknown>>(
  table: string,
  select = '*',
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < 1_000_000; offset += pageSize) {
    const response = await sbFetch(
      `/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${pageSize}&offset=${offset}`,
    );
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/** Inserta o actualiza filas por su clave primaria (merge-duplicates). */
export async function sbUpsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict?: string,
): Promise<void> {
  if (rows.length === 0) return;
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  await sbFetch(`/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  }, 15000);
}

/** Borra las filas cuyo valor de `column` esté en la lista. */
export async function sbDeleteIn(
  table: string,
  column: string,
  values: (string | number)[],
): Promise<void> {
  if (values.length === 0) return;
  const list = values
    .map((value) => (typeof value === 'number' ? String(value) : `"${String(value).replace(/"/g, '\\"')}"`))
    .join(',');
  await sbFetch(`/rest/v1/${table}?${column}=in.(${list})`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

/** Comprueba que el proyecto responde y que la clave es válida. */
export async function sbPing(): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    await sbFetch('/rest/v1/', {}, 6000);
    return { ok: true };
  } catch (error) {
    const status = error instanceof SupabaseError ? error.status : undefined;
    return { ok: false, status, error: error instanceof Error ? error.message : String(error) };
  }
}
