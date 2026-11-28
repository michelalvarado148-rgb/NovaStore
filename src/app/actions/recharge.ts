'use server';

import { guardStoreOpen } from '@/lib/maintenance';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { centsFromInput } from '@/lib/format';
import { createRechargeRequest, reviewRechargeRequest } from '@/lib/recharge';
import { getPaymentMethods } from '@/lib/catalog';
import { notifyAdminNewRecharge } from '@/lib/push';

/** El cliente solicita una recarga y adjunta su comprobante. */
export async function createRechargeAction(formData: FormData) {
  await guardStoreOpen();
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

/**
 * Revisa una solicitud de recarga.
 *
 * La acción llega como argumento (no como campo del formulario) porque el
 * valor del botón pulsado no viaja en el FormData de una acción de servidor:
 * enviarlo ahí hacía que el ID y la acción se leyeran vacíos.
 */
async function review(formData: FormData, action: 'aprobar' | 'rechazar') {
  const admin = await requireAdmin('/admin/recargas');
  const rawId = String(formData.get('id') ?? '').trim();
  const id = Number(rawId);

  if (!rawId || !Number.isInteger(id) || id <= 0) {
    redirect(
      `/admin/recargas?error=${encodeURIComponent(
        'No pudimos identificar la solicitud. Actualiza la página e inténtalo nuevamente.',
      )}`,
    );
  }

  const result = reviewRechargeRequest({
    id,
    action,
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
        ? `Solicitud #${id} aprobada: el saldo se acreditó al cliente una sola vez.`
        : `Solicitud #${id} rechazada. No se acreditó saldo y el cliente verá el motivo.`,
    )}`,
  );
}

/** Botón Aprobar: acredita el saldo del cliente. */
export async function approveRechargeAction(formData: FormData) {
  await review(formData, 'aprobar');
}

/** Botón Rechazar: cambia el estado sin acreditar saldo. */
export async function rejectRechargeAction(formData: FormData) {
  await review(formData, 'rechazar');
}
