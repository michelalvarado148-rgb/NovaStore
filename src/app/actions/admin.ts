'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { centsFromInput } from '@/lib/format';
import {
  deleteCategory,
  deleteOffer,
  deleteProduct,
  moveProductsToCategory,
  saveCategory,
  saveOffer,
  savePaymentMethod,
  saveProduct,
  saveSettings,
  toggleOffer,
  toggleUserActive,
  type VariantInput,
} from '@/lib/admin';
import { adjustBalance, restoreStockForOrder, updateOrder } from '@/lib/orders';
import { deleteProductNotice, saveProductNotice } from '@/lib/product-notice';
import { clearPaymentQrUrl, savePaymentQrUrl } from '@/lib/payment-qr';

function back(path: string, message: string, type: 'ok' | 'error' = 'error'): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

function intOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function parseVariants(formData: FormData): VariantInput[] {
  const names = formData.getAll('variant_name').map(String);
  const prices = formData.getAll('variant_price').map(String);
  const stocks = formData.getAll('variant_stock').map(String);
  const ids = formData.getAll('variant_id').map(String);

  return names
    .map((name, index) => ({
      id: ids[index] && ids[index] !== '0' ? Number(ids[index]) : undefined,
      name,
      priceCents:
        prices[index] && prices[index].trim() !== '' ? centsFromInput(prices[index]) : null,
      stock:
        stocks[index] && stocks[index].trim() !== ''
          ? Number.parseInt(stocks[index], 10)
          : null,
    }))
    .filter((variant) => variant.name.trim().length > 0);
}

/* ------------------------------ Productos ---------------------------- */

/** Lee la sección «Avisos y requisitos del producto» del formulario de producto. */
function noticeInputFrom(formData: FormData) {
  const labels = formData.getAll('notice_field_label').map((value) => String(value ?? ''));
  const required = formData.getAll('notice_field_required').map((value) => String(value ?? ''));
  return {
    enabled: formData.get('notice_enabled') === 'on',
    type: String(formData.get('notice_type') ?? 'personalizado'),
    message: String(formData.get('notice_message') ?? ''),
    deliveryTime: String(formData.get('notice_delivery') ?? ''),
    fields: labels.map((label, index) => ({ label, required: required[index] === '1' })),
  };
}

export async function saveProductAction(formData: FormData) {
  await requireAdmin('/admin/productos');
  const id = intOrNull(formData.get('id'));
  const stockRaw = String(formData.get('stock') ?? '').trim();
  const compareRaw = String(formData.get('compare_price') ?? '').trim();

  const result = saveProduct({
    id: id ?? undefined,
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    categoryId: intOrNull(formData.get('category_id')),
    imageUrl: String(formData.get('image_url') ?? '').trim() || null,
    priceCents: centsFromInput(formData.get('price')),
    comparePriceCents: compareRaw ? centsFromInput(compareRaw) : null,
    stock: stockRaw === '' ? null : Number.parseInt(stockRaw, 10),
    isActive: formData.get('is_active') === 'on',
    isFeatured: formData.get('is_featured') === 'on',
    variants: parseVariants(formData),
  });

  if (!result.ok) back(id ? `/admin/productos/${id}` : '/admin/productos/nuevo', result.error);

  // El aviso se guarda en la misma operación: editar el aviso nunca obliga a borrar el producto.
  const notice = saveProductNotice(result.id, noticeInputFrom(formData));
  if (!notice.ok) back(`/admin/productos/${result.id}`, notice.error);

  revalidatePath('/admin/productos');
  revalidatePath('/productos');
  revalidatePath('/');
  redirect(`/admin/productos?ok=${encodeURIComponent('Producto guardado correctamente.')}`);
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin('/admin/productos');
  const id = Number(formData.get('id') ?? 0);
  if (!id) back('/admin/productos', 'Producto inválido.');
  const result = deleteProduct(id);
  revalidatePath('/admin/productos');
  revalidatePath('/productos');
  if (!result.ok) back('/admin/productos', result.error);
  deleteProductNotice(id);
  redirect(`/admin/productos?ok=${encodeURIComponent('Producto eliminado.')}`);
}

/* ----------------------------- Categorías ---------------------------- */

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin('/admin/categorias');
  const id = intOrNull(formData.get('id'));
  const result = saveCategory({
    id: id ?? undefined,
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    imageUrl: String(formData.get('image_url') ?? '').trim() || null,
    position: Number.parseInt(String(formData.get('position') ?? '0'), 10) || 0,
    isActive: formData.get('is_active') === 'on',
    parentId: intOrNull(formData.get('parent_id')),
  });
  if (!result.ok) back('/admin/categorias', result.error);
  revalidatePath('/admin/categorias');
  revalidatePath('/productos');
  revalidatePath('/');
  redirect(`/admin/categorias?ok=${encodeURIComponent('Categoría guardada.')}`);
}

export async function moveProductsAction(formData: FormData) {
  await requireAdmin('/admin/categorias');
  const targetCategoryId = Number(formData.get('target_category_id') ?? 0);
  const productIds = formData.getAll('product_ids').map((value) => Number(value));
  const result = moveProductsToCategory({ productIds, targetCategoryId });
  revalidatePath('/admin/categorias');
  if (!result.ok) back('/admin/categorias', result.error);
  revalidatePath('/admin/productos');
  revalidatePath('/productos');
  revalidatePath('/');
  redirect(
    `/admin/categorias?ok=${encodeURIComponent(`${result.moved} producto(s) movido(s) correctamente.`)}`,
  );
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin('/admin/categorias');
  const id = Number(formData.get('id') ?? 0);
  const result = deleteCategory(id);
  revalidatePath('/admin/categorias');
  if (!result.ok) back('/admin/categorias', result.error);
  redirect(`/admin/categorias?ok=${encodeURIComponent('Categoría eliminada.')}`);
}

/* ------------------------------- Ofertas ----------------------------- */

export async function saveOfferAction(formData: FormData) {
  await requireAdmin('/admin/ofertas');
  const id = intOrNull(formData.get('id'));
  const result = saveOffer({
    id: id ?? undefined,
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    productId: intOrNull(formData.get('product_id')),
    categoryId: intOrNull(formData.get('category_id')),
    discountPercent: Number.parseInt(String(formData.get('discount_percent') ?? '0'), 10),
    startsAt: String(formData.get('starts_at') ?? '').trim() || null,
    endsAt: String(formData.get('ends_at') ?? '').trim() || null,
    isActive: formData.get('is_active') === 'on',
  });
  if (!result.ok) back('/admin/ofertas', result.error);
  revalidatePath('/admin/ofertas');
  revalidatePath('/');
  revalidatePath('/productos');
  redirect(`/admin/ofertas?ok=${encodeURIComponent('Oferta guardada.')}`);
}

export async function toggleOfferAction(formData: FormData) {
  await requireAdmin('/admin/ofertas');
  toggleOffer(Number(formData.get('id') ?? 0));
  revalidatePath('/admin/ofertas');
  revalidatePath('/');
  redirect('/admin/ofertas?ok=' + encodeURIComponent('Estado de la oferta actualizado.'));
}

export async function deleteOfferAction(formData: FormData) {
  await requireAdmin('/admin/ofertas');
  deleteOffer(Number(formData.get('id') ?? 0));
  revalidatePath('/admin/ofertas');
  revalidatePath('/');
  redirect('/admin/ofertas?ok=' + encodeURIComponent('Oferta eliminada.'));
}

/* --------------------------- Pedidos / pagos ------------------------- */

export async function updateOrderAction(formData: FormData) {
  const admin = await requireAdmin('/admin/pedidos');
  const orderId = Number(formData.get('order_id') ?? 0);
  const status = String(formData.get('status') ?? '') || undefined;
  const paymentStatus = String(formData.get('payment_status') ?? '') || undefined;
  const adminNote = String(formData.get('admin_note') ?? '');
  const creditBalance = formData.get('credit_balance') === 'on';

  if (!orderId) back('/admin/pedidos', 'Pedido inválido.');

  const result = updateOrder({
    orderId,
    status: status as never,
    paymentStatus: paymentStatus as never,
    adminNote,
    adminId: admin.id,
    restoreStock: formData.get('restore_stock') === 'on',
  });

  if (!result.ok) back(`/admin/pedidos/${orderId}`, result.error);

  if (creditBalance) {
    const total = Number(formData.get('total_cents') ?? 0);
    const userId = Number(formData.get('user_id') ?? 0);
    if (userId && total > 0) {
      adjustBalance({
        userId,
        amountCents: total,
        type: 'reembolso',
        description: `Reembolso por pedido #${orderId}`,
        adminId: admin.id,
      });
    }
  }

  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
  revalidatePath('/cuenta');
  redirect(`/admin/pedidos/${orderId}?ok=${encodeURIComponent('Pedido actualizado.')}`);
}

export async function restoreStockAction(formData: FormData) {
  await requireAdmin('/admin/pedidos');
  const orderId = Number(formData.get('order_id') ?? 0);
  if (!orderId) back('/admin/pedidos', 'Pedido inválido.');
  restoreStockForOrder(orderId);
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath('/admin/productos');
  redirect(`/admin/pedidos/${orderId}?ok=${encodeURIComponent('Stock restaurado.')}`);
}

/* ------------------------------- Saldos ------------------------------ */

export async function adjustBalanceAction(formData: FormData) {
  const admin = await requireAdmin('/admin/saldos');
  const userId = Number(formData.get('user_id') ?? 0);
  const amount = centsFromInput(formData.get('amount'));
  const type = String(formData.get('type') ?? 'ajuste') as 'recarga' | 'compra' | 'reembolso' | 'ajuste';
  const description = String(formData.get('description') ?? '').trim() || 'Ajuste manual';

  const result = adjustBalance({ userId, amountCents: amount, type, description, adminId: admin.id });
  if (!result.ok) back('/admin/saldos', result.error);

  revalidatePath('/admin/saldos');
  revalidatePath('/admin/clientes');
  revalidatePath('/cuenta');
  redirect('/admin/saldos?ok=' + encodeURIComponent('Saldo actualizado.'));
}

/* ---------------------------- Clientes ------------------------------- */

export async function toggleCustomerAction(formData: FormData) {
  await requireAdmin('/admin/clientes');
  const id = Number(formData.get('user_id') ?? 0);
  const result = toggleUserActive(id);
  revalidatePath('/admin/clientes');
  if (!result.ok) back('/admin/clientes', result.error);
  redirect('/admin/clientes?ok=' + encodeURIComponent('Estado del cliente actualizado.'));
}

/* ------------------------- Métodos de pago --------------------------- */

export async function savePaymentMethodAction(formData: FormData) {
  await requireAdmin('/admin/pagos');
  const result = savePaymentMethod({
    id: Number(formData.get('id') ?? 0),
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    accountInfo: String(formData.get('account_info') ?? ''),
    instructions: String(formData.get('instructions') ?? ''),
    isEnabled: formData.get('is_enabled') === 'on',
    position: Number.parseInt(String(formData.get('position') ?? '0'), 10) || 0,
  });
  if (!result.ok) back('/admin/pagos', result.error);
  revalidatePath('/admin/pagos');
  revalidatePath('/checkout');
  redirect('/admin/pagos?ok=' + encodeURIComponent('Método de pago actualizado.'));
}

/* --------------------------- Configuración --------------------------- */

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin('/admin/configuracion');
  const keys = [
    'store_name',
    'store_tagline',
    'store_description',
    'telegram_url',
    'contact_email',
    'contact_phone',
    'support_hours',
    'order_prefix',
    'hero_title',
    'hero_subtitle',
    'announcement',
  ];
  const entries: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (value !== null) entries[key] = String(value).trim();
  }
  saveSettings(entries);
  revalidatePath('/', 'layout');
  redirect('/admin/configuracion?ok=' + encodeURIComponent('Configuración guardada.'));
}

/* ------------------------------ QR de pago --------------------------- */

export async function savePaymentQrAction(formData: FormData) {
  await requireAdmin('/admin/qr-pago');
  const result = savePaymentQrUrl(String(formData.get('payment_qr_url') ?? ''));
  if (!result.ok) back('/admin/qr-pago', result.error);

  revalidatePath('/admin/qr-pago');
  revalidatePath('/cuenta/saldo');
  redirect(
    '/admin/qr-pago?ok=' +
      encodeURIComponent('QR de pago guardado. Los clientes ya lo ven al añadir saldo.'),
  );
}

export async function clearPaymentQrAction() {
  await requireAdmin('/admin/qr-pago');
  clearPaymentQrUrl();
  revalidatePath('/admin/qr-pago');
  revalidatePath('/cuenta/saldo');
  redirect(
    '/admin/qr-pago?ok=' +
      encodeURIComponent('QR de pago eliminado. Los clientes verán que aún no está disponible.'),
  );
}
