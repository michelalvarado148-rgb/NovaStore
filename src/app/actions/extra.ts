'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { deleteExtraPage, saveExtraPage } from '@/lib/extra';

const ADMIN_PATH = '/admin/extra';

export async function saveExtraPageAction(formData: FormData) {
  await requireAdmin(ADMIN_PATH);

  const result = saveExtraPage({
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    icon: String(formData.get('icon') ?? ''),
    href: String(formData.get('href') ?? ''),
    position: String(formData.get('position') ?? '100'),
    isActive: String(formData.get('is_active') ?? '') === 'on',
  });

  if (!result.ok) {
    redirect(`${ADMIN_PATH}?error=${encodeURIComponent(result.error)}#nueva`);
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath('/extra');
  redirect(
    `${ADMIN_PATH}?ok=${encodeURIComponent(
      `Página «${result.page.title}» guardada en la sección EXTRA.`,
    )}`,
  );
}

export async function deleteExtraPageAction(formData: FormData) {
  await requireAdmin(ADMIN_PATH);
  const slug = String(formData.get('slug') ?? '').trim();

  const result = deleteExtraPage(slug);
  if (!result.ok) {
    redirect(`${ADMIN_PATH}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath('/extra');
  redirect(`${ADMIN_PATH}?ok=${encodeURIComponent('Página eliminada de la sección EXTRA.')}`);
}
