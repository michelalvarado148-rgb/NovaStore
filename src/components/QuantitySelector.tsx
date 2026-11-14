'use client';

import { useState } from 'react';
import { formatPEN } from '@/lib/format';
import {
  basisLabel,
  describeQtyRange,
  formatUnitPrice,
  quantityPresets,
  totalCentsFor,
  unitPriceCents,
  validateQuantity,
  type QtyConfig,
} from '@/lib/qty-rules';

/**
 * Selector de cantidad para productos con «cantidad personalizada».
 * Las cantidades sugeridas y los límites salen de la configuración del admin;
 * el servidor vuelve a validar la cantidad al agregar al carrito y al pagar.
 */
export default function QuantitySelector({
  priceCents,
  config,
  available = null,
}: {
  priceCents: number;
  config: QtyConfig;
  available?: number | null;
}) {
  const presets = quantityPresets(config);
  const [value, setValue] = useState<string>(String(config.min));

  const parsed = value.trim() === '' ? Number.NaN : Number(value);
  const check = validateQuantity(config, parsed);
  const quantity = check.ok ? check.quantity : 0;
  const total = totalCentsFor(priceCents, quantity, config);
  const unit = unitPriceCents(priceCents, config);

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div>
        <p className="text-sm font-semibold text-white">Elige la cantidad</p>
        <p className="mt-0.5 text-xs text-slate-400">{describeQtyRange(config)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const disabled = available !== null && preset > available;
          const active = value === String(preset);
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => setValue(String(preset))}
              className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
                active
                  ? 'border-violet-400 bg-violet-500/25 text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-violet-400/60 hover:text-white'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {preset.toLocaleString('es-PE')}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="label">Cantidad exacta</span>
          <input
            type="number"
            name="quantity"
            inputMode="numeric"
            min={config.min}
            max={config.max ?? undefined}
            step={config.step}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="input"
            required
          />
        </label>
        <div className="rounded-lg border border-white/10 bg-black/40 p-2.5">
          <p className="text-xs text-slate-400">Precio por unidad</p>
          <p className="text-sm font-bold text-white">
            {formatUnitPrice(unit)}{' '}
            <span className="text-xs font-normal text-slate-400">({basisLabel(config.basis)})</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Total a pagar</p>
          <p className="text-lg font-black text-violet-300">{formatPEN(total)}</p>
        </div>
      </div>

      {!check.ok ? (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
          {check.error}
        </p>
      ) : available !== null && quantity > available ? (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
          Solo quedan {available} unidades disponibles de este producto.
        </p>
      ) : null}
    </div>
  );
}
