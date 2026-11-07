import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
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
 * ADMIN_PASSWORD configurado. Vive aquí para poder detectar si la cuenta
 * sigue usando ese valor conocido.
 */
export const DEFAULT_ADMIN_PASSWORD = 'NovaStore2026!';

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
    secure: process.env.NODE_ENV === 'production',
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

type Attempt = { count: number; blockedUntil: number };
const attempts = new Map<string, Attempt>();

export function checkLoginRate(key: string): string | null {
  const entry = attempts.get(key);
  if (!entry) return null;
  if (entry.blockedUntil > Date.now()) {
    const seconds = Math.ceil((entry.blockedUntil - Date.now()) / 1000);
    return `Demasiados intentos fallidos. Intenta nuevamente en ${seconds} segundos.`;
  }
  return null;
}

export function registerFailedLogin(key: string): void {
  const entry = attempts.get(key) ?? { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.blockedUntil = Date.now() + 5 * 60 * 1000;
    entry.count = 0;
  }
  attempts.set(key, entry);
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
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
