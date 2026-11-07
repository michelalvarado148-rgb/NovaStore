'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  authenticate,
  clearLoginAttempts,
  checkLoginRate,
  createSession,
  registerCustomer,
  registerFailedLogin,
  safeNextPath,
} from '@/lib/auth';
import { getDb, nowIso } from '@/lib/db';
import { mergeGuestCart } from '@/lib/cart';

function loginError(message: string, next: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNextPath(formData.get('next'));

  if (!email || !password) {
    loginError('Ingresa tu correo y contraseña.', next);
  }
  const blocked = checkLoginRate(email);
  if (blocked) {
    loginError(blocked, next);
  }

  const result = authenticate(email, password);
  if (!result.ok) {
    registerFailedLogin(email);
    loginError(result.error, next);
  }

  clearLoginAttempts(email);
  await createSession(result.user.id);
  mergeGuestCart(result.user.id);
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function registerAction(formData: FormData) {
  const name = String(formData.get('name') ?? '');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const next = safeNextPath(formData.get('next'), '/cuenta');

  const back = (message: string): never =>
    redirect(
      `/registro?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`,
    );

  if (password !== confirm) back('Las contraseñas no coinciden.');

  const result = registerCustomer({ name, email, password, phone });
  if (!result.ok) back(result.error);

  // El rol siempre es 'customer': un cliente no puede autoasignarse privilegios.
  getDb()
    .prepare('UPDATE users SET updated_at = ? WHERE id = ?')
    .run(nowIso(), result.userId);

  await createSession(result.userId);
  mergeGuestCart(result.userId);
  revalidatePath('/', 'layout');
  redirect('/cuenta?bienvenida=1');
}
