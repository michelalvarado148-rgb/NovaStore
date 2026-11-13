'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { centsFromInput } from '@/lib/format';
import { createRechargeRequest, reviewRechargeRequest } from '@/lib/recharge';
import { getPaymentMethods } from '@/lib/catalog';
import { notifyAdminNewRecharge } from '@/lib/push';

/** El cliente solicita una recarga y adjunta su comprobante. */
export async function createRechargeAction(formData: FormData) {
  const user = await requireUser('/cuenta/saldo');
  const entry = formData.get('proof');
  const file = entry instanceof File && entry.size > 0 ? entry : null;
  const amountCents = centsFromInput(formData.get('amount'));
  const methodCode = String(formData.get('method') ?? '').trim();

  const result = await createRechargeRequest({
    userId: user.id,
    amountCents,
    method: String(formData.get('method') ?? ''),
    reference: String(formData.get('reference') ?? ''),
    note: String(formData.get('note') ?? ''),
    file,
  });

  if (!result.ok) {
    redirect(`/cuenta/saldo?error=${encodeURIComponent(result.error)}#recarga`);
  }

  // Aviso al administrador; si el push falla, la solicitud sigue registrada.
  try {
    const methodName =
      getPaymentMethods(true).find((item) => item.code === methodCode)?.name ?? 'Pago';
    await notifyAdminNewRecharge({ id: result.id, amountCents, methodName });
  } catch (error) {
    console.warn(
      '[novastore] no se pudo enviar la notificación push de la recarga:',
      error instanceof Error ? error.message : String(error),
    );
  }

  revalidatePath('/cuenta/saldo');
  revalidatePath('/admin/recargas');
  revalidatePath('/admin');
  redirect(
    `/cuenta/saldo?ok=${encodeURIComponent(
      'Solicitud enviada. El administrador revisará tu comprobante y acreditará el saldo.',
    )}#recarga`,
  );
}

/** El administrador aprueba o rechaza una solicitud de recarga. */
export async function reviewRechargeAction(formData: FormData) {
  const admin = await requireAdmin('/admin/recargas');
  const id = Number(formData.get('id') ?? 0);
  const action = String(formData.get('action') ?? '');

  if (!id || (action !== 'aprobar' && action !== 'rechazar')) {
    redirect(`/admin/recargas?error=${encodeURIComponent('Solicitud inválida.')}`);
  }

  const result = reviewRechargeRequest({
    id,
    action: action as 'aprobar' | 'rechazar',
    adminId: admin.id,
    adminNote: String(formData.get('admin_note') ?? ''),
  });

  if (!result.ok) {
    redirect(`/admin/recargas?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/admin/recargas');
  revalidatePath('/admin/saldos');
  revalidatePath('/admin/clientes');
  revalidatePath('/cuenta/saldo');
  revalidatePath('/cuenta');
  redirect(
    `/admin/recargas?ok=${encodeURIComponent(
      action === 'aprobar'
        ? 'Recarga aprobada y saldo acreditado al cliente.'
        : 'Solicitud rechazada. El cliente verá el motivo.',
    )}`,
  );
}
