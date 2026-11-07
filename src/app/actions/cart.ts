'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addToCart, removeCartItem, updateCartItem } from '@/lib/cart';

export async function addToCartAction(formData: FormData) {
  const productId = Number(formData.get('product_id') ?? 0);
  const variantRaw = String(formData.get('variant_id') ?? '').trim();
  const variantId = variantRaw && variantRaw !== '0' ? Number(variantRaw) : null;
  const quantity = Math.max(1, Math.min(20, Number(formData.get('quantity') ?? 1) || 1));
  const back = String(formData.get('back') ?? '/carrito');

  const result = await addToCart(productId, variantId, quantity);
  revalidatePath('/', 'layout');
  if (!result.ok) {
    redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(result.error)}`);
  }
  redirect('/carrito?agregado=1');
}

export async function updateCartAction(formData: FormData) {
  const itemId = Number(formData.get('item_id') ?? 0);
  const quantity = Math.max(0, Math.min(20, Number(formData.get('quantity') ?? 0) || 0));
  await updateCartItem(itemId, quantity);
  revalidatePath('/', 'layout');
  redirect('/carrito');
}

export async function removeCartAction(formData: FormData) {
  const itemId = Number(formData.get('item_id') ?? 0);
  await removeCartItem(itemId);
  revalidatePath('/', 'layout');
  redirect('/carrito');
}
