/**
 * Sección EXTRA de NOVASTORE.
 *
 * Agrupa las páginas adicionales de la tienda. NovaWallet es la primera y viene
 * incluida (no se puede eliminar). El administrador puede agregar más tarjetas
 * desde /admin/extra; cada tarjeta enlaza a una ruta de la propia tienda o a un
 * enlace externo.
 *
 * Las páginas creadas se guardan en `settings` con el prefijo `extra:page:`, así
 * que se replican en Supabase con el resto de la configuración y entran en las
 * copias de seguridad.
 */
import { getDb, nowIso } from './db';

export type ExtraPage = {
  slug: string;
  title: string;
  description: string;
  /** Emoji o símbolo corto que se muestra en la tarjeta. */
  icon: string;
  /** Ruta interna ("/algo") o enlace externo ("https://…"). */
  href: string;
  is_active: boolean;
  position: number;
  builtin: boolean;
};

const PREFIX = 'extra:page:';
const MAX_TITLE = 60;
const MAX_DESCRIPTION = 220;
const MAX_ICON = 4;

export const NOVAWALLET_PAGE: ExtraPage = {
  slug: 'novawallet',
  title: 'NovaWallet',
  description: 'Tu alcancía digital: guarda dinero, recarga por Yape y solicita retiros.',
  icon: '👛',
  href: '/extra/novawallet',
  is_active: true,
  position: 0,
  builtin: true,
};

function readPage(slug: string): ExtraPage | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(`${PREFIX}${slug}`) as
    | { value: string }
    | undefined;
  if (!row) return null;
  try {
    const raw = JSON.parse(row.value) as Partial<ExtraPage>;
    return normalizePage(raw, slug);
  } catch {
    return null;
  }
}

function normalizePage(raw: Partial<ExtraPage>, fallbackSlug: string): ExtraPage {
  return {
    slug: typeof raw.slug === 'string' && raw.slug ? raw.slug : fallbackSlug,
    title: typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_TITLE) : '',
    description:
      typeof raw.description === 'string' ? raw.description.trim().slice(0, MAX_DESCRIPTION) : '',
    icon: typeof raw.icon === 'string' && raw.icon.trim() ? raw.icon.trim().slice(0, MAX_ICON) : '✨',
    href: typeof raw.href === 'string' ? raw.href.trim().slice(0, 500) : '',
    is_active: raw.is_active !== false,
    position: Number.isFinite(Number(raw.position)) ? Math.round(Number(raw.position)) : 100,
    builtin: false,
  };
}

export function slugifyExtra(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function listExtraPages(includeInactive = false): ExtraPage[] {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'extra:page:%'")
    .all() as { key: string; value: string }[];

  const pages: ExtraPage[] = [];
  for (const row of rows) {
    const slug = row.key.slice(PREFIX.length);
    if (!slug || slug === NOVAWALLET_PAGE.slug) continue;
    try {
      const page = normalizePage(JSON.parse(row.value) as Partial<ExtraPage>, slug);
      if (page.title && page.href) pages.push(page);
    } catch {
      // Una tarjeta corrupta no debe romper la sección.
    }
  }

  const sorted = pages.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  const all = [NOVAWALLET_PAGE, ...sorted];
  return includeInactive ? all : all.filter((page) => page.is_active);
}

export function getExtraPage(slug: string): ExtraPage | null {
  if (slug === NOVAWALLET_PAGE.slug) return NOVAWALLET_PAGE;
  return readPage(slug);
}

export type ExtraSaveResult = { ok: true; page: ExtraPage } | { ok: false; error: string };

export function saveExtraPage(input: {
  title: string;
  description: string;
  icon: string;
  href: string;
  position: string | number;
  isActive: boolean;
}): ExtraSaveResult {
  const title = input.title.trim().slice(0, MAX_TITLE);
  if (title.length < 2) return { ok: false, error: 'Escribe un nombre para la página.' };

  const href = input.href.trim().slice(0, 500);
  if (!href.startsWith('/') && !/^https?:\/\//i.test(href)) {
    return {
      ok: false,
      error: 'El destino debe ser una ruta de la tienda (por ejemplo /contacto) o un enlace https://.',
    };
  }

  const slug = slugifyExtra(title);
  if (!slug) return { ok: false, error: 'El nombre debe incluir letras o números.' };
  if (slug === NOVAWALLET_PAGE.slug) {
    return { ok: false, error: 'Ese nombre está reservado por NovaWallet. Usa otro.' };
  }

  const page = normalizePage(
    {
      slug,
      title,
      description: input.description,
      icon: input.icon,
      href,
      is_active: input.isActive,
      position: Number(input.position) || 100,
    },
    slug,
  );

  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(`${PREFIX}${slug}`, JSON.stringify(page), nowIso());

  return { ok: true, page };
}

export function deleteExtraPage(slug: string): { ok: true } | { ok: false; error: string } {
  if (slug === NOVAWALLET_PAGE.slug) {
    return { ok: false, error: 'NovaWallet es parte fija de la sección EXTRA y no se puede eliminar.' };
  }
  const result = getDb().prepare('DELETE FROM settings WHERE key = ?').run(`${PREFIX}${slug}`);
  if (result.changes === 0) return { ok: false, error: 'Esa página ya no existe.' };
  return { ok: true };
}
