/**
 * QR de pago de las recargas de saldo.
 *
 * La imagen la sube el administrador con el módulo de medios (Supabase Storage
 * o la tabla `settings` según la configuración del servidor) y aquí solo se
 * guarda su URL en la configuración de la tienda, de modo que todos los
 * clientes ven el mismo QR desde cualquier dispositivo.
 *
 * No existe un QR por defecto: mientras el administrador no suba el suyo, la
 * tienda informa que todavía no está disponible.
 */
import { getSetting, setSetting } from './catalog';

export const PAYMENT_QR_KEY = 'payment_qr_url';
const MAX_URL_LENGTH = 2048;

export type PaymentQrResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Solo se aceptan imágenes servidas por la propia tienda (/api/media/<id>) o
 * por Supabase Storage. Así una URL externa, un SVG o un enlace `javascript:`
 * no pueden ocupar el lugar del QR.
 */
export function isAllowedPaymentQrUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url || url.length > MAX_URL_LENGTH) return false;

  if (url.startsWith('/api/media/')) {
    return /^\/api\/media\/[0-9a-f-]{20,40}$/i.test(url);
  }
  if (!/^https:\/\//i.test(url)) return false;

  try {
    const parsed = new URL(url);
    const isStorageObject = parsed.pathname.includes('/storage/v1/object/public/');
    const isImage = /\.(png|jpe?g|webp)$/i.test(parsed.pathname);
    return isStorageObject && isImage;
  } catch {
    return false;
  }
}

/** URL del QR configurado, o cadena vacía si aún no existe o no es válida. */
export function getPaymentQrUrl(): string {
  const raw = getSetting(PAYMENT_QR_KEY, '').trim();
  return isAllowedPaymentQrUrl(raw) ? raw : '';
}

export function hasPaymentQr(): boolean {
  return getPaymentQrUrl() !== '';
}

/** Guarda (o reemplaza) el QR. Solo debe llamarse desde una acción de administrador. */
export function savePaymentQrUrl(raw: string): PaymentQrResult {
  const url = raw.trim();
  if (!url) {
    return { ok: false, error: 'Sube la imagen del QR antes de guardar.' };
  }
  if (!isAllowedPaymentQrUrl(url)) {
    return {
      ok: false,
      error: 'La imagen del QR debe ser un archivo JPG, PNG o WEBP subido desde este panel.',
    };
  }
  setSetting(PAYMENT_QR_KEY, url);
  return { ok: true, url };
}

/** Quita el QR: la tienda vuelve a avisar que no está disponible. */
export function clearPaymentQrUrl(): void {
  setSetting(PAYMENT_QR_KEY, '');
}
