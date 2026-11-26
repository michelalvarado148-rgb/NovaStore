'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { centsFromInput } from '@/lib/format';
import { saveImage, validateImage } from '@/lib/media';
import {
  createWalletRecharge,
  createWalletWithdrawal,
  reviewWalletRequest,
  saveWalletConfig,
} from '@/lib/wallet';

const WALLET_PATH = '/extra/novawallet';
const ADMIN_PATH = '/admin/wallet';

function backToWallet(params: string): never {
  redirect(`${WALLET_PATH}?${params}#solicitudes`);
}

/** El cliente registra un depósito por Yape con su comprobante (queda pendiente). */
export async function createWalletRechargeAction(formData: FormData) {
  const user = await requireUser(WALLET_PATH);

  const entry = formData.get('proof');
  const file = entry instanceof File && entry.size > 0 ? entry : null;
  if (!file) {
    backToWallet(`error=${encodeURIComponent('Adjunta la imagen de tu comprobante de Yape.')}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const check = validateImage(buffer, file.type);
  if (!check.ok) {
    backToWallet(`error=${encodeURIComponent(check.error)}`);
  }

  let proofUrl = '';
  try {
    const saved = await saveImage(buffer, check.kind, 'pagos');
    proofUrl = saved.url;
  } catch {
    backToWallet(
      `error=${encodeURIComponent(
        'No se pudo guardar tu comprobante en el almacenamiento. Inténtalo nuevamente.',
      )}`,
    );
  }

  const result = createWalletRecharge({
    userId: user.id,
    amountCents: centsFromInput(formData.get('amount')),
    reference: String(formData.get('reference') ?? ''),
    note: String(formData.get('note') ?? ''),
    proofUrl,
    proofName: file.name,
  });

  if (!result.ok) {
    backToWallet(`error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(WALLET_PATH);
  revalidatePath(ADMIN_PATH);
  backToWallet(
    `ok=${encodeURIComponent(
      'Solicitud enviada. Tu saldo se acreditará cuando el administrador verifique el comprobante.',
    )}`,
  );
}

/** El cliente solicita un retiro de su alcancía (queda pendiente). */
export async function createWalletWithdrawalAction(formData: FormData) {
  const user = await requireUser(WALLET_PATH);

  const result = createWalletWithdrawal({
    userId: user.id,
    amountCents: centsFromInput(formData.get('amount')),
    method: String(formData.get('method') ?? ''),
    note: String(formData.get('note') ?? ''),
  });

  if (!result.ok) {
    backToWallet(`error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(WALLET_PATH);
  revalidatePath(ADMIN_PATH);
  backToWallet(
    `ok=${encodeURIComponent(
      'Solicitud de retiro registrada. El administrador la revisará y el saldo se descontará al aprobarla.',
    )}`,
  );
}

/** El administrador guarda número de Yape, avisos, comisiones y montos mínimos. */
export async function saveWalletConfigAction(formData: FormData) {
  await requireAdmin(ADMIN_PATH);

  const result = saveWalletConfig({
    yapeNumber: String(formData.get('yape_number') ?? ''),
    yapeHolder: String(formData.get('yape_holder') ?? ''),
    notice: String(formData.get('notice') ?? ''),
    feeEnabled: String(formData.get('fee_enabled') ?? '') === 'on',
    feePercent: String(formData.get('fee_percent') ?? '0'),
    feeFixedCents: centsFromInput(formData.get('fee_fixed')),
    minRechargeCents: centsFromInput(formData.get('min_recharge')),
    minWithdrawCents: centsFromInput(formData.get('min_withdraw')),
  });

  if (!result.ok) {
    redirect(`${ADMIN_PATH}?error=${encodeURIComponent(result.error)}#config`);
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(WALLET_PATH);
  redirect(
    `${ADMIN_PATH}?ok=${encodeURIComponent('Configuración de NovaWallet guardada.')}#config`,
  );
}

/** Aprueba o rechaza una recarga o un retiro. El saldo solo cambia al aprobar. */
export async function reviewWalletRequestAction(formData: FormData) {
  const admin = await requireAdmin(ADMIN_PATH);
  const id = Number(formData.get('id') ?? 0);
  const action = String(formData.get('action') ?? '');

  if (!id || (action !== 'aprobar' && action !== 'rechazar')) {
    redirect(`${ADMIN_PATH}?error=${encodeURIComponent('Solicitud inválida.')}#solicitudes`);
  }

  const result = reviewWalletRequest({
    id,
    action: action as 'aprobar' | 'rechazar',
    adminId: admin.id,
    adminNote: String(formData.get('admin_note') ?? ''),
  });

  if (!result.ok) {
    redirect(`${ADMIN_PATH}?error=${encodeURIComponent(result.error)}#solicitudes`);
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(WALLET_PATH);
  redirect(
    `${ADMIN_PATH}?ok=${encodeURIComponent(
      action === 'aprobar'
        ? 'Solicitud aprobada. El saldo de NovaWallet quedó actualizado.'
        : 'Solicitud rechazada. El cliente verá el motivo.',
    )}#solicitudes`,
  );
}
