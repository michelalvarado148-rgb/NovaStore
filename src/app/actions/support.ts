'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { sendAdminMessage, sendCustomerMessage } from '@/lib/support';

/** Mensaje del cliente en su conversación privada con el administrador. */
export async function sendSupportMessageAction(formData: FormData) {
  const user = await requireUser('/cuenta/soporte');
  const result = sendCustomerMessage(user.id, String(formData.get('body') ?? ''));

  if (!result.ok) {
    redirect(`/cuenta/soporte?error=${encodeURIComponent(result.error)}#conversacion`);
  }

  revalidatePath('/cuenta/soporte');
  revalidatePath('/admin/soporte');
  redirect('/cuenta/soporte#conversacion');
}

/** Respuesta del administrador en la conversación de un cliente. */
export async function adminSupportReplyAction(formData: FormData) {
  const admin = await requireAdmin('/admin/soporte');
  const threadId = Number(formData.get('thread_id') ?? 0);
  if (!threadId) {
    redirect(`/admin/soporte?error=${encodeURIComponent('Conversación inválida.')}`);
  }

  const result = sendAdminMessage(admin.id, threadId, String(formData.get('body') ?? ''));
  if (!result.ok) {
    redirect(`/admin/soporte?thread=${threadId}&error=${encodeURIComponent(result.error)}#conversacion`);
  }

  revalidatePath('/admin/soporte');
  revalidatePath('/cuenta/soporte');
  redirect(`/admin/soporte?thread=${threadId}#conversacion`);
}
