/**
 * Almacenamiento de imágenes de productos y categorías.
 *
 * Dos modos, elegidos automáticamente:
 *
 * 1. `bucket`: si el servidor tiene SUPABASE_SERVICE_ROLE_KEY, las imágenes se
 *    suben al bucket público de Supabase Storage (novastore-media) y la URL
 *    pública queda guardada en products.image_url / categories.image_url.
 * 2. `database`: mientras no exista esa clave, las imágenes se guardan como
 *    registro binario en la tabla `settings` de Supabase (claves `media:*`) y
 *    se sirven desde /api/media/<id>. También es almacenamiento permanente: no
 *    depende del navegador ni de la memoria temporal del dispositivo.
 *
 * En ambos modos la URL guardada en la base de datos es la misma para todos los
 * dispositivos y sobrevive a cierres de sesión y despliegues.
 */
import { randomUUID } from 'node:crypto';
import { sbQuery } from './supabase-rest';

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MEDIA_BUCKET = (process.env.SUPABASE_MEDIA_BUCKET || 'novastore-media').trim();

export type ImageKind = 'jpeg' | 'png' | 'webp';
export type MediaStorage = 'bucket' | 'database';
export type MediaFolder = 'productos' | 'categorias';

const MIME_BY_KIND: Record<ImageKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const EXT_BY_KIND: Record<ImageKind, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

function supabaseUrl(): string {
  return (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
}

function serviceKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

/** Modo de almacenamiento activo en este servidor. */
export function mediaStorageMode(): MediaStorage {
  return supabaseUrl() && serviceKey() ? 'bucket' : 'database';
}

/** Detecta el formato real por los bytes de cabecera (no por la extensión). */
export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export type ImageValidation =
  | { ok: true; kind: ImageKind; mime: string }
  | { ok: false; error: string };

/** Valida tamaño y contenido real del archivo. */
export function validateImage(buffer: Buffer, declaredMime: string): ImageValidation {
  if (buffer.length === 0) {
    return { ok: false, error: 'El archivo está vacío. Elige otra imagen.' };
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `La imagen pesa ${(buffer.length / (1024 * 1024)).toFixed(1)} MB y el máximo es 6 MB.`,
    };
  }
  const kind = detectImageKind(buffer);
  if (!kind) {
    return {
      ok: false,
      error: 'Formato no admitido. Solo se permiten imágenes JPG, PNG o WEBP.',
    };
  }
  if (declaredMime && !(ALLOWED_IMAGE_MIME as readonly string[]).includes(declaredMime)) {
    return {
      ok: false,
      error: 'Formato no admitido. Solo se permiten imágenes JPG, PNG o WEBP.',
    };
  }
  return { ok: true, kind, mime: MIME_BY_KIND[kind] };
}

/* --------------------------- Modo bucket (Storage) --------------------------- */

async function ensureBucket(): Promise<void> {
  const base = supabaseUrl();
  const key = serviceKey();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const existing = await fetch(`${base}/storage/v1/bucket/${MEDIA_BUCKET}`, { headers });
  if (existing.ok) return;
  if (existing.status !== 404) {
    const detail = await existing.text().catch(() => '');
    throw new Error(`No se pudo consultar el bucket de Supabase (${existing.status}). ${detail}`.trim());
  }

  const created = await fetch(`${base}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: MEDIA_BUCKET,
      name: MEDIA_BUCKET,
      public: true,
      file_size_limit: MAX_IMAGE_BYTES,
      allowed_mime_types: [...ALLOWED_IMAGE_MIME],
    }),
  });
  if (!created.ok) {
    const detail = await created.text().catch(() => '');
    throw new Error(`No se pudo crear el bucket ${MEDIA_BUCKET} (${created.status}). ${detail}`.trim());
  }
}

async function saveToBucket(buffer: Buffer, kind: ImageKind, folder: MediaFolder): Promise<string> {
  const base = supabaseUrl();
  const key = serviceKey();
  await ensureBucket();

  const path = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${EXT_BY_KIND[kind]}`;
  const upload = await fetch(`${base}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': MIME_BY_KIND[kind],
      'cache-control': 'public, max-age=31536000, immutable',
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
  });

  if (!upload.ok) {
    const detail = await upload.text().catch(() => '');
    throw new Error(`Supabase Storage rechazó la imagen (${upload.status}). ${detail}`.trim());
  }

  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/* -------------------------- Modo base de datos ------------------------------ */

// Las imágenes se guardan en la tabla `settings` de Supabase con el prefijo
// `media:`. Es almacenamiento permanente y compartido entre dispositivos; el
// escaparate y el sincronizador ignoran estas claves (ver catalog.ts y
// persistence.ts) para no cargar los binarios en cada página.
const MEDIA_PREFIX = 'media:';

async function saveToDatabase(buffer: Buffer, kind: ImageKind): Promise<string> {
  const id = randomUUID();
  const payload = `data:${MIME_BY_KIND[kind]};base64,${buffer.toString('base64')}`;
  await sbQuery(
    `insert into public.settings (key, value, updated_at) values ($1, $2, $3)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [`${MEDIA_PREFIX}${id}`, payload, new Date().toISOString()],
  );
  return `/api/media/${id}`;
}

/* --------------------------------- API -------------------------------------- */

export type SavedImage = { url: string; storage: MediaStorage; bytes: number; mime: string };

/** Guarda la imagen validada y devuelve la URL que debe ir a la base de datos. */
export async function saveImage(
  buffer: Buffer,
  kind: ImageKind,
  folder: MediaFolder,
): Promise<SavedImage> {
  const storage = mediaStorageMode();
  const url =
    storage === 'bucket'
      ? await saveToBucket(buffer, kind, folder)
      : await saveToDatabase(buffer, kind);
  return { url, storage, bytes: buffer.length, mime: MIME_BY_KIND[kind] };
}

export type StoredImage = { mime: string; data: Buffer };

/** Lee una imagen guardada en la base de datos (modo `database`). */
export async function readStoredImage(id: string): Promise<StoredImage | null> {
  if (!/^[0-9a-f-]{20,40}$/i.test(id)) return null;
  const rows = await sbQuery<{ value: string }>(
    'select value from public.settings where key = $1',
    [`${MEDIA_PREFIX}${id}`],
  );
  const row = rows[0];
  if (!row) return null;
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(String(row.value ?? ''));
  if (!match) return null;
  return { mime: match[1], data: Buffer.from(match[2], 'base64') };
}
