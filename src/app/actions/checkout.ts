'use server';

import { guardStoreOpen } from '@/lib/maintenance';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getCart } from '@/lib/cart';
import { getPaymentMethods } from '@/lib/catalog';
import { SALDO_METHOD, placeOrder, type ProofInput } from '@/lib/orders';
import { getActiveNotices, saveOrderNoticeAnswers } from '@/lib/product-notice';
import {
  MAX_FIELD_VALUE,
  type NoticeAnswerPayload,
  type OrderNoticeAnswer,
} from '@/lib/notice-meta';
import { notifyAdminNewOrder, notifyAdminNewProof } from '@/lib/push';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

export async function placeOrderAction(formData: FormData) {
  await guardStoreOpen();
  const user = await requireUser('/checkout');
  const paymentMethod = String(formData.get('payment_method') ?? '').trim();
  const contactEmail = String(formData.get('contact_email') ?? '').trim();
  const contactPhone = String(formData.get('contact_phone') ?? '').trim();
  const customerNote = String(formData.get('customer_note') ?? '').trim().slice(0, 500);
  const idempotencyKey = String(formData.get('idempotency_key') ?? '').trim() || randomUUID();
  // El pago con saldo no pide ni acepta comprobante: se cobra del saldo del cliente.
  const payingWithBalance = paymentMethod === SALDO_METHOD;

  // Declaración con retorno `never`: corta el flujo y TypeScript descarta la rama de error.
  function fail(message: string): never {
    redirect(`/checkout?error=${encodeURIComponent(message)}`);
  }

  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(contactEmail)) {
    fail('Ingresa un correo de contacto válido.');
  }
  if (!/^[0-9+\s()-]{6,20}$/.test(contactPhone)) {
    fail('Ingresa un teléfono de contacto válido.');
  }

  const method = getPaymentMethods(true).find((item) => item.code === paymentMethod);
  if (!method) {
    fail('Selecciona un método de pago válido.');
  }

  let proof: ProofInput | null = null;
  const file = formData.get('proof');
  if (!payingWithBalance && file instanceof File && file.size > 0) {
    if (file.size > MAX_PROOF_BYTES) {
      fail('El comprobante no debe superar los 5 MB.');
    }
    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      fail('El comprobante debe ser una imagen (PNG, JPG, WEBP, GIF) o PDF.');
    }
    proof = {
      fileName: (file.name || 'comprobante').slice(0, 120),
      mimeType,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    };
  }

  const cart = await getCart();
  if (cart.lines.length === 0) {
    fail('Tu carrito está vacío.');
  }
  if (!payingWithBalance && !proof) {
    fail('Adjunta la imagen de tu comprobante de pago para continuar.');
  }

  // Avisos y requisitos por producto: se validan aquí, en el servidor, antes de
  // cobrar el saldo o registrar el pedido con un método externo.
  const noticeMap = getActiveNotices(cart.lines.map((line) => line.product_id));
  const noticeAnswers: OrderNoticeAnswer[] = [];
  if (noticeMap.size > 0) {
    let payload: NoticeAnswerPayload[] = [];
    try {
      const parsed = JSON.parse(String(formData.get('notice_answers') ?? '[]'));
      if (Array.isArray(parsed)) payload = parsed as NoticeAnswerPayload[];
    } catch {
      payload = [];
    }

    const provided = new Map<number, Map<string, string>>();
    for (const item of payload) {
      const productId = Number(item?.productId);
      if (!Number.isInteger(productId)) continue;
      const values = new Map<string, string>();
      for (const value of Array.isArray(item?.values) ? item.values : []) {
        const label = String(value?.label ?? '').trim();
        if (!label) continue;
        values.set(label, String(value?.value ?? '').trim().slice(0, MAX_FIELD_VALUE));
      }
      provided.set(productId, values);
    }

    const names = new Map<number, string>();
    for (const line of cart.lines) {
      if (!names.has(line.product_id)) names.set(line.product_id, line.name);
    }

    for (const [productId, notice] of noticeMap) {
      const productName = names.get(productId) ?? 'Producto';
      const values = provided.get(productId);
      if (!values) {
        fail(`Debes leer y confirmar el aviso de "${productName}" antes de continuar.`);
      }
      const answers = notice.fields.map((field) => ({
        label: field.label,
        required: field.required,
        value: (values.get(field.label) ?? '').slice(0, MAX_FIELD_VALUE),
      }));
      const missing = answers.find((answer) => answer.required && !answer.value);
      if (missing) {
        fail(`Completa el dato "${missing.label}" para "${productName}".`);
      }
      noticeAnswers.push({
        productId,
        productName,
        type: notice.type,
        message: notice.message,
        deliveryTime: notice.deliveryTime,
        values: answers,
        acknowledgedAt: new Date().toISOString(),
      });
    }
  }

  const result = placeOrder({
    userId: user.id,
    paymentMethod: method.code,
    contactEmail,
    contactPhone,
    customerNote,
    idempotencyKey,
    proof,
  });

  revalidatePath('/', 'layout');
  if (!result.ok) {
    redirect(`/checkout?error=${encodeURIComponent(result.error)}`);
  }

  // Los avisos aceptados y los datos del cliente quedan guardados con el pedido.
  if (!result.duplicated && noticeAnswers.length > 0) {
    saveOrderNoticeAnswers(result.orderNumber, noticeAnswers);
  }

  // Aviso al teléfono del administrador. Un pedido repetido no vuelve a notificar
  // y un fallo de push nunca impide registrar la compra.
  if (!result.duplicated) {
    try {
      await notifyAdminNewOrder({
        orderNumber: result.orderNumber,
        totalCents: result.totalCents,
        methodName: method.name,
      });
      if (result.hasProof) {
        await notifyAdminNewProof({
          orderNumber: result.orderNumber,
          totalCents: result.totalCents,
        });
      }
    } catch (error) {
      console.warn(
        '[novastore] no se pudo enviar la notificación push del pedido:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  redirect(`/pedido/${result.orderNumber}?nuevo=1`);
}
