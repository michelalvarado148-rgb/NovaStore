import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MAX_IMAGE_BYTES, saveImage, validateImage, type MediaFolder } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return fail('Tu sesión expiró. Vuelve a iniciar sesión como administrador.', 401);
  }
  if (user.role !== 'admin') {
    return fail('Solo el administrador puede subir imágenes.', 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('No se pudo leer el archivo. Inténtalo de nuevo.');
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return fail('Selecciona una imagen JPG, PNG o WEBP.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail('La imagen supera los 6 MB. Elige una más liviana.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateImage(buffer, file.type);
  if (!validation.ok) {
    return fail(validation.error);
  }

  const folderRaw = form.get('folder');
  const folder: MediaFolder =
    folderRaw === 'categorias'
      ? 'categorias'
      : folderRaw === 'pagos'
        ? 'pagos'
        : folderRaw === 'mantenimiento'
          ? 'mantenimiento'
          : 'productos';

  try {
    const saved = await saveImage(buffer, validation.kind, folder);
    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[novastore] error al subir imagen:', message);
    return fail('No se pudo guardar la imagen en Supabase. Inténtalo de nuevo.', 502);
  }
}
