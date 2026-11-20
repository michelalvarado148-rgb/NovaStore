'use server';

import { guardStoreOpen } from '@/lib/maintenance';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addToCart, removeCartItem, updateCartItem } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';
import { isFreeFireProduct, saveFreeFireId, validateFreeFireId } from '@/lib/freefire';

export async function addToCartAction(formData: FormData) {
  await guardStoreOpen();
  const productId = Number(formData.get('product_id') ?? 0);
  const variantRaw = String(formData.get('variant_id') ?? '').trim();
  const variantId = variantRaw && variantRaw !== '0' ? Number(variantRaw) : null;
  const quantity = Math.max(1, Math.min(20, Number(formData.get('quantity') ?? 1) || 1));
  const back = String(formData.get('back') ?? '/carrito');

  // Los productos de Free Fire exigen el ID del jugador antes de continuar.
  if (isFreeFireProduct(productId)) {
    const checked = validateFreeFireId(String(formData.get('ff_player_id') ?? ''));
    if (!checked.ok) {
      redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(checked.error)}`);
    }
    const user = await getCurrentUser();
    if (user) saveFreeFireId(user.id, checked.value);
  }

  const result = await addToCart(productId, variantId, quantity);
  revalidatePath('/', 'layout');
  if (!result.ok) {
    redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(result.error)}`);
  }
  redirect('/carrito?agregado=1');
}

export async function updateCartAction(formData: FormData) {
  await guardStoreOpen();
  const itemId = Number(formData.get('item_id') ?? 0);
  const quantity = Math.max(0, Math.min(20, Number(formData.get('quantity') ?? 0) || 0));
  await updateCartItem(itemId, quantity);
  revalidatePath('/', 'layout');
  redirect('/carrito');
}

export async function removeCartAction(formData: FormData) {
  await guardStoreOpen();
  const itemId = Number(formData.get('item_id') ?? 0);
  await removeCartItem(itemId);
  revalidatePath('/', 'layout');
  redirect('/carrito');
}
