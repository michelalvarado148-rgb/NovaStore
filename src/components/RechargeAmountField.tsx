'use client';

import { useState } from 'react';

type Props = {
  /** Monto mínimo permitido, en soles. El servidor lo vuelve a validar. */
  minAmount: number;
  /** Valor controlado desde el formulario de recarga. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Botones de monto rápido (por ejemplo 10, 20, 50, 100, 200). */
  quickAmounts?: number[];
  /** Mensaje de error mostrado desde el flujo de pasos. */
  error?: string | null;
  required?: boolean;
  className?: string;
};

/**
 * Campo del monto de recarga con validación visible en el navegador.
 * El mínimo real lo vuelve a validar el servidor en createRechargeRequest.
 */
export function RechargeAmountField({
  minAmount,
  value: controlledValue,
  onValueChange,
  quickAmounts = [],
  error,
  required = true,
  className = '',
}: Props) {
  const [internalValue, setInternalValue] = useState('');
  const [touchedError, setTouchedError] = useState(false);

  const value = controlledValue ?? internalValue;
  const minLabel = minAmount.toFixed(2);
  const parsed = Number(value);
  const tooLow = value.trim() !== '' && Number.isFinite(parsed) && parsed < minAmount;

  const setValue = (next: string) => {
    if (onValueChange) onValueChange(next);
    else setInternalValue(next);
    if (touchedError && Number(next) >= minAmount) setTouchedError(false);
  };

  const shownError =
    error ??
    (touchedError && tooLow
      ? `El monto mínimo de recarga es S/ ${minLabel}. Ingresa S/ ${minLabel} o más.`
      : null);

  return (
    <div className={className}>
      {quickAmounts.length > 0 ? (
        <div className="ns-rc-quick" role="group" aria-label="Montos rápidos de recarga">
          {quickAmounts.map((amount) => {
            const active = Number(value) === amount;
            return (
              <button
                key={amount}
                type="button"
                className={`ns-rc-chip${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => {
                  setValue(String(amount));
                  setTouchedError(false);
                }}
              >
                S/ {amount}
              </button>
            );
          })}
        </div>
      ) : null}

      <label className="ns-rc-field" htmlFor="recharge-amount">
        <span className="ns-rc-field-label">Monto a recargar (S/)</span>
        <div className={`ns-rc-amount-box${shownError ? ' is-invalid' : ''}`}>
          <span className="ns-rc-amount-prefix" aria-hidden="true">
            S/
          </span>
          <input
            id="recharge-amount"
            type="number"
            name="amount"
            required={required}
            min={minAmount}
            step="0.10"
            inputMode="decimal"
            placeholder="20.00"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => setTouchedError(tooLow)}
            aria-invalid={shownError ? true : undefined}
            aria-describedby="recharge-amount-help"
            className="ns-rc-amount-input"
          />
        </div>
        {shownError ? (
          <span id="recharge-amount-help" className="ns-rc-error" role="alert">
            {shownError}
          </span>
        ) : (
          <span id="recharge-amount-help" className="ns-rc-help">
            Recarga mínima S/ {minLabel} · No hay monto máximo.
          </span>
        )}
      </label>
    </div>
  );
}
