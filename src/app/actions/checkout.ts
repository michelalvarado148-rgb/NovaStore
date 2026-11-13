'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getCart } from '@/lib/cart';
import { getPaymentMethods } from '@/lib/catalog';
import { SALDO_METHOD, placeOrder, type ProofInput } from '@/lib/orders';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

export async function placeOrderAction(formData: FormData) {
  const user = await requireUser('/checkout');
  const paymentMethod = String(formData.get('payment_method') ?? '').trim();
  const contactEmail = String(formData.get('contact_email') ?? '').trim();
  const contactPhone = String(formData.get('contact_phone') ?? '').trim();
  const customerNote = String(formData.get('customer_note') ?? '').trim().slice(0, 500);
  const idempotencyKey = String(formData.get('idempotency_key') ?? '').trim() || randomUUID();
  // El pago con saldo no pide ni acepta comprobante: se cobra del saldo del cliente.
  const payingWithBalance = paymentMethod === SALDO_METHOD;

  // `never`: corta el flujo, así TypeScript sabe que las validaciones no continúan.
  const fail = (message: string): never =>
    redirect(`/checkout?error=${encodeURIComponent(message)}`);

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
  redirect(`/pedido/${result.orderNumber}?nuevo=1`);
}
