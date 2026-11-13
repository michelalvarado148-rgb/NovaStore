import { readStoredImage } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sirve las imágenes guardadas en Supabase (modo base de datos). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const image = await readStoredImage(id);
    if (!image) {
      return new Response('Imagen no encontrada', { status: 404 });
    }
    return new Response(new Uint8Array(image.data), {
      headers: {
        'Content-Type': image.mime,
        'Content-Length': String(image.data.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[novastore] error al leer imagen:', message);
    return new Response('No se pudo cargar la imagen', { status: 503 });
  }
}
