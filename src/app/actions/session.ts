'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { destroySession, requireUser } from '@/lib/auth';
import { getDb, hashPassword, nowIso, verifyPassword } from '@/lib/db';

export async function logoutAction() {
  await destroySession();
  revalidatePath('/', 'layout');
  redirect('/?sesion=cerrada');
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser('/cuenta/perfil');
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();

  if (name.length < 3) {
    redirect('/cuenta/perfil?error=' + encodeURIComponent('Ingresa tu nombre completo.'));
  }

  // El cliente solo puede modificar sus propios datos personales.
  getDb()
    .prepare('UPDATE users SET name = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?')
    .run(name, phone || null, address || null, nowIso(), user.id);

  revalidatePath('/cuenta', 'layout');
  redirect('/cuenta/perfil?ok=' + encodeURIComponent('Datos actualizados correctamente.'));
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser('/cuenta/perfil');
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next_password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const row = getDb()
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(user.id) as { password_hash: string } | undefined;

  if (!row || !verifyPassword(current, row.password_hash)) {
    redirect('/cuenta/perfil?error=' + encodeURIComponent('Tu contraseña actual no es correcta.'));
  }
  if (next.length < 8) {
    redirect(
      '/cuenta/perfil?error=' +
        encodeURIComponent('La nueva contraseña debe tener al menos 8 caracteres.'),
    );
  }
  if (next !== confirm) {
    redirect('/cuenta/perfil?error=' + encodeURIComponent('Las contraseñas no coinciden.'));
  }

  getDb()
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hashPassword(next), nowIso(), user.id);

  redirect('/cuenta/perfil?ok=' + encodeURIComponent('Contraseña actualizada.'));
}
