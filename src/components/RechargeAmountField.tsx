'use client';

import { useState } from 'react';

/**
 * Campo del monto de recarga con validación visible en el navegador.
 * El mínimo real lo vuelve a validar el servidor en createRechargeRequest.
 */
export function RechargeAmountField({ minAmount }: { minAmount: number }) {
  const [value, setValue] = useState('');
  const [showError, setShowError] = useState(false);
  const minLabel = minAmount.toFixed(2);
  const parsed = Number(value);
  const tooLow = value.trim() !== '' && Number.isFinite(parsed) && parsed < minAmount;

  return (
    <label className="block text-sm text-slate-300">
      Monto a recargar (S/)
      <input
        type="number"
        name="amount"
        required
        min={minAmount}
        step="0.10"
        inputMode="decimal"
        placeholder="20.00"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (showError && Number(event.target.value) >= minAmount) setShowError(false);
        }}
        onBlur={() => setShowError(tooLow)}
        aria-invalid={showError || undefined}
        aria-describedby="recharge-amount-help"
        className="input mt-1.5 w-full"
      />
      {showError ? (
        <span className="mt-1 block text-xs font-semibold text-rose-300" role="alert">
          El monto mínimo de recarga es S/ {minLabel}. Ingresa S/ {minLabel} o más.
        </span>
      ) : (
        <span id="recharge-amount-help" className="mt-1 block text-xs text-slate-400">
          Recarga mínima S/ {minLabel}. No hay monto máximo.
        </span>
      )}
    </label>
  );
}
