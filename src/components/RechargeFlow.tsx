'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { RechargeAmountField } from '@/components/RechargeAmountField';
import { createRechargeAction } from '@/app/actions/recharge';
import { formatPEN } from '@/lib/format';

type MethodOption = {
  code: string;
  name: string;
  account_info: string;
  instructions: string;
};

const QUICK_AMOUNTS = [10, 20, 50, 100, 200];

const STEPS = [
  { id: 1, label: 'Monto', hint: 'Elige cuánto recargar' },
  { id: 2, label: 'Comprobante', hint: 'Adjunta tu pago' },
  { id: 3, label: 'Confirmar', hint: 'Revisa y envía' },
] as const;

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
      <path d="M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
      <path d="M21 10.5h-4.1a2.25 2.25 0 0 0 0 4.5H21z" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </svg>
  );
}

function IconQr() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h2v2h-2zM19 14.5h1.5M14.5 19H16M18 18h2.5v2.5H18z" />
    </svg>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="ns-rc-submit" disabled={pending} aria-busy={pending}>
      <IconCheck />
      <span>{pending ? 'Enviando solicitud…' : 'Confirmar recarga'}</span>
    </button>
  );
}

export function RechargeFlow({
  minAmount,
  qrUrl,
  methods,
  pending,
}: {
  minAmount: number;
  qrUrl: string | null;
  methods: MethodOption[];
  pending: number;
}) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  const numericAmount = Number(amount);
  const cents =
    Number.isFinite(numericAmount) && numericAmount > 0 ? Math.round(numericAmount * 100) : 0;
  const amountLabel = formatPEN(cents);
  const methodName = methods.find((item) => item.code === method)?.name ?? 'Sin seleccionar';

  const goTo = (next: number) => {
    setStep(next);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAmountNext = () => {
    if (!Number.isFinite(numericAmount) || numericAmount < minAmount) {
      setAmountError(`Ingresa un monto de S/ ${minAmount.toFixed(2)} o más para continuar.`);
      return;
    }
    setAmountError(null);
    goTo(2);
  };

  const handleProofNext = () => {
    if (!method) {
      setFileError('Selecciona el método de pago que usaste.');
      return;
    }
    if (!fileRef.current?.files?.[0]) {
      setFileError('Adjunta la imagen o PDF de tu comprobante.');
      return;
    }
    setFileError(null);
    goTo(3);
  };

  return (
    <section id="recarga" className="ns-rc-card" ref={cardRef}>
      <header className="ns-rc-head">
        <div className="ns-rc-head-main">
          <span className="ns-rc-head-icon">
            <IconWallet />
          </span>
          <div className="ns-rc-head-text">
            <p className="ns-rc-eyebrow">Recarga de saldo</p>
            <h2 className="ns-rc-title">Añadir saldo</h2>
            <p className="ns-rc-sub">
              Paga por Yape, Plin o transferencia y envía tu comprobante.
            </p>
          </div>
        </div>
        <div className="ns-rc-live" aria-live="polite">
          <span className="ns-rc-live-label">
            <IconWallet />
            Recargando
          </span>
          <strong>{amountLabel}</strong>
        </div>
      </header>

      <ol className="ns-rc-steps" aria-label="Pasos de la recarga">
        {STEPS.map((item) => {
          const state = step === item.id ? 'is-active' : step > item.id ? 'is-done' : '';
          return (
            <li key={item.id} className={`ns-rc-step ${state}`.trim()}>
              <button
                type="button"
                className="ns-rc-step-btn"
                onClick={() => {
                  if (item.id < step) setStep(item.id);
                }}
                disabled={item.id > step}
                aria-current={step === item.id ? 'step' : undefined}
              >
                <span className="ns-rc-step-dot">
                  {step > item.id ? <IconCheck /> : item.id}
                </span>
                <span className="ns-rc-step-text">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="ns-rc-progress" aria-hidden="true">
        <span style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
      </div>

      <div className="ns-rc-body">
        <ul className="ns-rc-notices">
          <li>
            <IconShield />
            <span>El saldo se acredita solo cuando el administrador verifica tu pago.</span>
          </li>
          <li>
            <IconClock />
            <span>Revisión normalmente en pocas horas hábiles.</span>
          </li>
          <li>
            <IconReceipt />
            <span>Adjunta una foto legible o PDF del comprobante.</span>
          </li>
        </ul>

        {pending > 0 ? (
          <p className="ns-rc-pending">
            Tienes {pending} solicitud(es) en revisión. Te avisaremos cuando el administrador la
            verifique.
          </p>
        ) : null}

        <form action={createRechargeAction} className="ns-rc-form">
          <div className="ns-rc-panel" hidden={step !== 1}>
            <RechargeAmountField
              minAmount={minAmount}
              value={amount}
              onValueChange={(next) => {
                setAmount(next);
                if (amountError) setAmountError(null);
              }}
              quickAmounts={QUICK_AMOUNTS}
              error={amountError}
              required={step === 1}
              className="ns-rc-amount"
            />

            <button type="button" className="ns-rc-next" onClick={handleAmountNext}>
              <span>Continuar</span>
              <IconArrow />
            </button>
            <p className="ns-rc-foot">
              Monto mínimo S/ {minAmount.toFixed(2)} · Sin monto máximo · Saldo en soles (PEN)
            </p>
          </div>

          <div className="ns-rc-panel" hidden={step !== 2}>
            <div className="ns-rc-tag">
              <span>Vas a recargar</span>
              <strong>{amountLabel}</strong>
            </div>

            {qrUrl ? (
              <div className="ns-rc-pay">
                <div className="ns-rc-pay-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl}
                    alt="Código QR para pagar tu recarga de saldo"
                    width={168}
                    height={168}
                  />
                </div>
                <div className="ns-rc-pay-text">
                  <p className="ns-rc-pay-title">
                    <IconQr />
                    Escanea el QR para pagar
                  </p>
                  <p className="ns-rc-pay-sub">
                    Abre Yape, Plin o la app de tu banco, escanea el código y paga{' '}
                    <strong>{amountLabel}</strong>. Luego adjunta tu comprobante.
                  </p>
                </div>
              </div>
            ) : (
              <div className="ns-rc-pay is-empty">
                <div className="ns-rc-pay-text">
                  <p className="ns-rc-pay-title">El QR de pago todavía no está disponible</p>
                  <p className="ns-rc-pay-sub">
                    El administrador aún no configuró su QR. Puedes pagar con los datos de los
                    métodos de abajo y adjuntar tu comprobante.
                  </p>
                </div>
              </div>
            )}

            {methods.length > 0 ? (
              <div className="ns-rc-methods">
                {methods.map((item) => (
                  <div key={item.code} className="ns-rc-method">
                    <p className="ns-rc-method-name">{item.name}</p>
                    <p className="ns-rc-method-info">{item.account_info}</p>
                    {item.instructions ? (
                      <p className="ns-rc-method-note">{item.instructions}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ns-rc-foot">
                El administrador aún no habilitó métodos de pago para recargas. Escríbenos por
                Soporte.
              </p>
            )}

            <div className="ns-rc-grid2">
              <label className="ns-rc-field" htmlFor="recharge-method">
                <span className="ns-rc-field-label">Método de pago</span>
                <select
                  id="recharge-method"
                  name="method"
                  required={step === 2}
                  value={method}
                  onChange={(event) => {
                    setMethod(event.target.value);
                    if (fileError) setFileError(null);
                  }}
                  className="ns-rc-input"
                >
                  <option value="">Selecciona un método</option>
                  {methods.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ns-rc-field" htmlFor="recharge-reference">
                <span className="ns-rc-field-label">N° de operación (opcional)</span>
                <input
                  id="recharge-reference"
                  type="text"
                  name="reference"
                  maxLength={60}
                  placeholder="Ej. 0123456"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="ns-rc-input"
                />
              </label>
            </div>

            <label className="ns-rc-file" htmlFor="recharge-proof">
              <span className="ns-rc-file-icon">
                <IconUpload />
              </span>
              <span className="ns-rc-file-text">
                <strong>Subir comprobante</strong>
                <small>Imagen JPG, PNG, WEBP o PDF · máximo 5 MB</small>
              </span>
              <span className="ns-rc-file-button">Elegir archivo</span>
              <input
                id="recharge-proof"
                ref={fileRef}
                type="file"
                name="proof"
                required={step === 2}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="ns-rc-file-input"
                onChange={(event) => {
                  setFileName(event.target.files?.[0]?.name ?? '');
                  if (fileError) setFileError(null);
                }}
              />
            </label>
            {fileName ? <p className="ns-rc-file-name">Archivo seleccionado: {fileName}</p> : null}
            {fileError ? (
              <p className="ns-rc-error" role="alert">
                {fileError}
              </p>
            ) : null}

            <div className="ns-rc-actions">
              <button type="button" className="ns-rc-back" onClick={() => setStep(1)}>
                Volver
              </button>
              <button type="button" className="ns-rc-next" onClick={handleProofNext}>
                <span>Continuar</span>
                <IconArrow />
              </button>
            </div>
          </div>

          <div className="ns-rc-panel" hidden={step !== 3}>
            <div className="ns-rc-summary">
              <p className="ns-rc-summary-title">Resumen de tu recarga</p>
              <dl className="ns-rc-summary-list">
                <div>
                  <dt>Monto</dt>
                  <dd className="is-amount">{amountLabel}</dd>
                </div>
                <div>
                  <dt>Método de pago</dt>
                  <dd>{methodName}</dd>
                </div>
                <div>
                  <dt>Comprobante</dt>
                  <dd>{fileName || 'Sin archivo'}</dd>
                </div>
                {reference ? (
                  <div>
                    <dt>N° de operación</dt>
                    <dd>{reference}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Estado</dt>
                  <dd>Queda en revisión</dd>
                </div>
              </dl>
            </div>

            <label className="ns-rc-field" htmlFor="recharge-note">
              <span className="ns-rc-field-label">Nota para el administrador (opcional)</span>
              <textarea
                id="recharge-note"
                name="note"
                rows={2}
                maxLength={500}
                placeholder="Ej. Pagué con Yape a nombre de…"
                className="ns-rc-input ns-rc-textarea"
              />
            </label>

            <div className="ns-rc-actions">
              <button type="button" className="ns-rc-back" onClick={() => setStep(2)}>
                Volver
              </button>
              <SubmitButton />
            </div>
            <p className="ns-rc-foot">
              Tu solicitud quedará pendiente hasta que el administrador verifique el pago. No se
              descuenta ni se acredita saldo automáticamente.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
