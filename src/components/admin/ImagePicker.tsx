'use client';

import { useEffect, useId, useRef, useState } from 'react';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

type UploadResponse = { ok?: boolean; url?: string; storage?: string; error?: string };

/**
 * Reduce fotos grandes de la galería antes de subirlas, para que la tienda
 * cargue rápido desde el celular. Si el navegador no puede procesarla, se sube
 * el archivo original.
 */
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= 1.2 * 1024 * 1024) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('No se pudo leer la imagen'));
      element.src = objectUrl;
    });
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    if (file.type !== 'image/png') {
      context.fillStyle = '#0b0b12';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, 0.86),
    );
    if (!blob || blob.size >= file.size) return file;
    const extension = outputType === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `imagen.${extension}`, { type: outputType });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function ImagePicker({
  name = 'image_url',
  label = 'Imagen',
  folder = 'productos',
  defaultValue = '',
}: {
  name?: string;
  label?: string;
  folder?: 'productos' | 'categorias' | 'pagos' | 'mantenimiento';
  defaultValue?: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultValue.trim());
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [manual, setManual] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setNotice('');

    if (!ALLOWED.includes(file.type)) {
      setError('Formato no admitido. Solo se permiten imágenes JPG, PNG o WEBP.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('La imagen es demasiado grande (máximo 20 MB antes de optimizarla).');
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setBusy(true);

    try {
      const prepared = await shrinkImage(file);
      if (prepared.size > MAX_BYTES) {
        throw new Error('La imagen sigue superando los 6 MB después de optimizarla. Elige otra.');
      }

      const body = new FormData();
      body.append('file', prepared);
      body.append('folder', folder);

      const response = await fetch('/api/admin/upload', { method: 'POST', body });
      const data = (await response.json().catch(() => ({}))) as UploadResponse;

      if (!response.ok || !data.ok || !data.url) {
        throw new Error(data.error || 'No se pudo subir la imagen. Inténtalo de nuevo.');
      }

      setUrl(data.url);
      setNotice(
        data.storage === 'bucket'
          ? 'Imagen subida a Supabase Storage. Guarda el formulario para aplicarla.'
          : 'Imagen guardada en Supabase. Guarda el formulario para aplicarla.',
      );
    } catch (uploadError) {
      setPreview('');
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }

  function removeImage() {
    setUrl('');
    setPreview('');
    setError('');
    setNotice('Imagen quitada. Guarda el formulario para confirmar el cambio.');
  }

  const shown = preview || url;

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Vista previa de la imagen" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-center text-[0.6rem] leading-tight text-slate-500">
              Sin
              <br />
              imagen
            </span>
          )}
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-black/65">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" />
            </span>
          ) : null}
        </div>

        <div className="flex-1 space-y-2">
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void handleFile(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {busy ? 'Subiendo imagen…' : 'Seleccionar imagen de galería'}
            </button>
            {shown ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={removeImage}
                disabled={busy}
              >
                Eliminar imagen
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setManual((value) => !value)}
              disabled={busy}
            >
              {manual ? 'Ocultar URL manual' : 'Usar URL manual'}
            </button>
          </div>

          {manual ? (
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value.trim())}
              placeholder="/images/products/ejemplo.svg o https://…"
              aria-label="URL manual de la imagen"
            />
          ) : null}

          <p className="text-[0.7rem] leading-snug text-slate-500">
            JPG, PNG o WEBP. Elige otra imagen para reemplazarla; se guarda en Supabase y queda
            disponible en todos tus dispositivos.
          </p>
          {busy ? <p className="text-[0.75rem] text-purple-200">Subiendo imagen… espera un momento.</p> : null}
          {error ? <p className="alert alert-error text-xs">{error}</p> : null}
          {!error && notice ? <p className="alert alert-ok text-xs">{notice}</p> : null}
        </div>
      </div>
    </div>
  );
}
