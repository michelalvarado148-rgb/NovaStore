'use client';

import { useEffect, useState } from 'react';
import ProductDurationBadge from '@/components/ProductDurationBadge';
import { DURATION_PRESETS, durationLabelFor, type ProductDuration } from '@/lib/duration-presets';

/**
 * Campo «Duración» del formulario de producto. Solo aparece cuando la
 * categoría elegida pertenece a Streaming (o es una subcategoría suya), de
 * modo que el resto de categorías no se modifica.
 */
export default function ProductDurationFields({
  streamingCategoryIds,
  initial = null,
}: {
  streamingCategoryIds: number[];
  initial?: ProductDuration | null;
}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [preset, setPreset] = useState<string>(initial?.preset ?? '');
  const [custom, setCustom] = useState<string>(initial?.custom ?? '');

  useEffect(() => {
    const select = document.querySelector<HTMLSelectElement>('select[name="category_id"]');
    if (!select) return;

    const sync = () => setIsStreaming(streamingCategoryIds.includes(Number(select.value)));
    sync();
    select.addEventListener('change', sync);
    return () => select.removeEventListener('change', sync);
  }, [streamingCategoryIds]);

  if (!isStreaming) return null;

  const preview = durationLabelFor(preset, custom);

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
      <h3 className="flex items-center gap-2 text-sm font-black text-white">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-violet-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.4V12l3 2.1" />
        </svg>
        Duración
      </h3>
      <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-400">
        Disponible solo para productos de Streaming. Cada producto guarda su propia duración.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Duración del servicio</span>
          <select name="duration_preset" value={preset} onChange={(event) => setPreset(event.target.value)}>
            <option value="">Sin duración (no mostrar)</option>
            {DURATION_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {preset === 'custom' ? (
          <label className="field">
            <span>Escribe la duración</span>
            <input
              name="duration_custom"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              maxLength={40}
              placeholder="Ej: 45 días, 18 meses, 2 semanas"
            />
          </label>
        ) : null}
      </div>

      {preview ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.72rem] text-slate-400">
          Así lo verá el cliente:
          <ProductDurationBadge label={preview} />
        </p>
      ) : (
        <p className="mt-3 text-[0.7rem] text-slate-500">
          Si dejas «Sin duración», la tarjeta y la ficha del producto no muestran ningún indicador.
        </p>
      )}
    </section>
  );
}
