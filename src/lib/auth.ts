import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  DEFAULT_ADMIN_PASSWORD,
  getDb,
  hashPassword,
  hashToken,
  newToken,
  nowIso,
  verifyPassword,
} from './db';

export const SESSION_COOKIE = 'nova_session';
export const CART_COOKIE = 'nova_cart';
const SESSION_DAYS = 30;

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'customer' | 'admin';
  balance_cents: number;
  is_active: number;
  created_at: string;
};

const USER_COLUMNS =
  'id, name, email, phone, role, balance_cents, is_active, created_at';

export function findUserById(id: number): SessionUser | null {
  const db = getDb();
  const user = db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(id) as SessionUser | undefined;
  return user ?? null;
}

export function findUserByEmail(email: string): (SessionUser & { password_hash: string }) | null {
  const db = getDb();
  const user = db
    .prepare(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ?`)
    .get(email.trim().toLowerCase()) as
    | (SessionUser & { password_hash: string })
    | undefined;
  return user ?? null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.balance_cents, u.is_active, u.created_at,
              s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`,
    )
    .get(hashToken(raw)) as (SessionUser & { expires_at: string }) | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(raw));
    return null;
  }
  if (!row.is_active) return null;

  const { expires_at: _expires, ...user } = row;
  return user;
}

export async function requireUser(nextPath = '/'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requireAdmin(nextPath = '/admin'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (user.role !== 'admin') {
    redirect('/cuenta');
  }
  return user;
}

/**
 * Contraseña que se usa al sembrar el administrador cuando no hay
 * ADMIN_PASSWORD configurado. Se define en db.ts, junto al sembrado, y se
 * reexporta aquí para que el aviso del panel use exactamente el mismo valor.
 */
export { DEFAULT_ADMIN_PASSWORD };

/**
 * Indica si la cuenta de administrador todavía conserva la contraseña por
 * defecto. Se comprueba contra el hash guardado (no contra las variables de
 * entorno) para detectar también el caso en que ADMIN_PASSWORD se definió
 * después de crear la cuenta y por tanto nunca llegó a aplicarse.
 */
export function adminUsesDefaultPassword(userId: number): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ? AND role = 'admin'")
    .get(userId) as { password_hash: string } | undefined;
  if (!row) return false;
  return verifyPassword(DEFAULT_ADMIN_PASSWORD, row.password_hash);
}

/**
 * En producción la cookie de sesión siempre viaja marcada como `secure`. Los
 * hosts de bucle (localhost, 127.0.0.1, ::1) se sirven por http en desarrollo y
 * pruebas locales, donde una cookie `secure` sería descartada por el navegador
 * y el usuario aparecería deslogueado; ahí se emite sin esa marca.
 */
async function sessionCookieSecure(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false;
  try {
    const host = ((await headers()).get('host') ?? '')
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '');
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
      return false;
    }
  } catch {
    // Sin acceso a las cabeceras se mantiene el comportamiento seguro.
  }
  return true;
}

export async function createSession(userId: number, userAgent?: string | null): Promise<void> {
  const db = getDb();
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, user_agent, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(hashToken(token), userId, userAgent?.slice(0, 250) ?? null, nowIso(), expires.toISOString());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await sessionCookieSecure(),
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(raw));
  }
  store.delete(SESSION_COOKIE);
}

/* --------------------------- Rate limiting --------------------------- */

export const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 5 * 60 * 1000;

/**
 * Los intentos fallidos se guardan en SQLite y no en memoria: así el bloqueo
 * sobrevive a un reinicio o redespliegue del contenedor, en lugar de reiniciarse
 * solo con volver a arrancar el proceso.
 */
export function checkLoginRate(key: string): string | null {
  const row = getDb()
    .prepare('SELECT blocked_until FROM login_attempts WHERE key = ?')
    .get(key) as { blocked_until: string | null } | undefined;

  const until = row?.blocked_until ? Date.parse(row.blocked_until) : NaN;
  if (!Number.isFinite(until) || until <= Date.now()) return null;

  const seconds = Math.ceil((until - Date.now()) / 1000);
  return `Demasiados intentos fallidos. Intenta nuevamente en ${seconds} segundos.`;
}

export function registerFailedLogin(key: string): void {
  const db = getDb();
  const row = db
    .prepare('SELECT count, blocked_until FROM login_attempts WHERE key = ?')
    .get(key) as { count: number; blocked_until: string | null } | undefined;

  const until = row?.blocked_until ? Date.parse(row.blocked_until) : NaN;

  // Con un bloqueo vigente no se acumulan más fallos.
  if (Number.isFinite(until) && until > Date.now()) return;

  // Un bloqueo ya vencido reinicia el contador.
  const previous = Number.isFinite(until) ? 0 : (row?.count ?? 0);
  const count = previous + 1;
  const blockedUntil =
    count >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOGIN_BLOCK_MS).toISOString() : null;

  db.prepare(
    `INSERT INTO login_attempts (key, count, blocked_until, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = excluded.count,
       blocked_until = excluded.blocked_until,
       updated_at = excluded.updated_at`,
  ).run(key, blockedUntil ? 0 : count, blockedUntil, nowIso());
}

export function clearLoginAttempts(key: string): void {
  getDb().prepare('DELETE FROM login_attempts WHERE key = ?').run(key);
}

/* ----------------------------- Registration -------------------------- */

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

export type RegisterResult =
  | { ok: true; userId: number }
  | { ok: false; error: string };

export function registerCustomer(input: RegisterInput): RegisterResult {
  const db = getDb();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;

  if (name.length < 3) {
    return { ok: false, error: 'Ingresa tu nombre completo.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'Ingresa un correo electrónico válido.' };
  }
  if (input.password.length < 8) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return { ok: false, error: 'Ya existe una cuenta registrada con ese correo.' };
  }

  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, phone, role, balance_cents, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'customer', 0, 1, ?, ?)`,
    )
    .run(name, email, hashPassword(input.password), phone, nowIso(), nowIso());

  return { ok: true, userId: Number(info.lastInsertRowid) };
}

export function authenticate(
  email: string,
  password: string,
): { ok: true; user: SessionUser } | { ok: false; error: string } {
  const user = findUserByEmail(email);
  if (!user) {
    return { ok: false, error: 'Correo o contraseña incorrectos.' };
  }
  if (!verifyPassword(password, user.password_hash)) {
    return { ok: false, error: 'Correo o contraseña incorrectos.' };
  }
  if (!user.is_active) {
    return { ok: false, error: 'Tu cuenta está desactivada. Contacta al administrador.' };
  }
  const { password_hash: _hash, ...safe } = user;
  return { ok: true, user: safe };
}

export function safeNextPath(value: unknown, fallback = '/cuenta'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
