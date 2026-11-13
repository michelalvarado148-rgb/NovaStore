/**
 * Modo mantenimiento de NOVASTORE.
 *
 * La configuración vive en la tabla `settings` (clave `maintenance:config`), la
 * misma que se sincroniza con Supabase, así que el estado sobrevive a recargas,
 * cierres de sesión y despliegues, y todos los visitantes ven el mismo valor.
 *
 * El bloqueo real se hace en el servidor: las páginas de la tienda y las
 * acciones de compra consultan `isStoreClosed()`. Ocultar botones no basta, por
 * eso ninguna ruta de compra se sirve mientras el mantenimiento esté activo.
 */
import { getSetting, setSetting } from './catalog';

export const MAINTENANCE_KEY = 'maintenance:config';
export const DEFAULT_MAINTENANCE_MESSAGE =
  'Estamos realizando mejoras en nuestra tienda para ofrecerte una mejor experiencia. ¡Volveremos pronto!';
export const MAX_MAINTENANCE_MESSAGE = 600;

export type MaintenanceConfig = {
  enabled: boolean;
  message: string;
  image_url: string;
  return_at: string;
};

const EMPTY_CONFIG: MaintenanceConfig = {
  enabled: false,
  message: '',
  image_url: '',
  return_at: '',
};

/** Configuración actual (nunca lanza: un valor corrupto equivale a desactivado). */
export function getMaintenanceConfig(): MaintenanceConfig {
  const raw = getSetting(MAINTENANCE_KEY, '');
  if (!raw) return { ...EMPTY_CONFIG };

  try {
    const parsed = JSON.parse(raw) as Partial<MaintenanceConfig>;
    return {
      enabled: parsed.enabled === true,
      message: typeof parsed.message === 'string' ? parsed.message.slice(0, MAX_MAINTENANCE_MESSAGE) : '',
      image_url: typeof parsed.image_url === 'string' ? parsed.image_url : '',
      return_at: typeof parsed.return_at === 'string' ? parsed.return_at : '',
    };
  } catch {
    return { ...EMPTY_CONFIG };
  }
}

/** Mensaje que ven los clientes: el del administrador o el texto por defecto. */
export function maintenanceMessage(config: MaintenanceConfig = getMaintenanceConfig()): string {
  return config.message.trim() || DEFAULT_MAINTENANCE_MESSAGE;
}

/**
 * Solo se aceptan imágenes servidas por la propia tienda (/api/media/<id> o
 * /images/...) o por el bucket público de Supabase. Sin imagen también es válido.
 */
export function isAllowedMaintenanceImage(raw: string): boolean {
  const url = raw.trim();
  if (!url) return true;
  if (url.length > 2048) return false;
  if (/^\/api\/media\/[0-9a-f-]{20,40}$/i.test(url)) return true;
  if (/^\/images\/[a-z0-9/_-]+\.(png|jpe?g|webp|svg)$/i.test(url)) return true;
  if (!/^https:\/\//i.test(url)) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.pathname.includes('/storage/v1/object/public/') &&
      /\.(png|jpe?g|webp)$/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export type SaveMaintenanceResult =
  | { ok: true; config: MaintenanceConfig }
  | { ok: false; error: string };

/** Guarda la configuración. Solo debe llamarse desde una acción de administrador. */
export function saveMaintenanceConfig(input: {
  enabled: boolean;
  message: string;
  imageUrl: string;
  returnAt: string;
}): SaveMaintenanceResult {
  const message = input.message.trim().slice(0, MAX_MAINTENANCE_MESSAGE);
  const imageUrl = input.imageUrl.trim();
  const returnAt = input.returnAt.trim();

  if (!isAllowedMaintenanceImage(imageUrl)) {
    return {
      ok: false,
      error: 'La imagen debe ser un archivo JPG, PNG o WEBP subido desde este panel.',
    };
  }
  if (returnAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(returnAt)) {
    return { ok: false, error: 'La fecha y hora de regreso no son válidas.' };
  }

  const config: MaintenanceConfig = {
    enabled: input.enabled === true,
    message,
    image_url: imageUrl,
    return_at: returnAt,
  };

  setSetting(MAINTENANCE_KEY, JSON.stringify(config));
  return { ok: true, config };
}

/** Fecha de regreso lista para mostrar (se interpreta en hora de Perú). */
export function formatReturnAt(value: string): string {
  if (!value) return '';
  const date = new Date(`${value}:00-05:00`);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Lima',
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * ¿Debe bloquearse la tienda para quien hace la petición?
 *
 * El administrador conserva el acceso completo (panel y vista de la tienda);
 * cualquier visitante o cliente recibe la pantalla de mantenimiento.
 */
export async function isStoreClosed(): Promise<boolean> {
  if (!getMaintenanceConfig().enabled) return false;

  try {
    // Import dinámico: permite usar las funciones de configuración en scripts
    // sin cargar `next/headers` fuera de una petición.
    const { getCurrentUser } = await import('./auth');
    const user = await getCurrentUser();
    return user?.role !== 'admin';
  } catch {
    return true;
  }
}
