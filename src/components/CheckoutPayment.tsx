'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatPEN } from '@/lib/format';

export type CheckoutMethod = {
  id: number;
  code: string;
  name: string;
  description: string;
  account_info: string;
  instructions: string;
};

const SALDO_CODE = 'saldo';

/**
 * Selector de método de pago del checkout.
 *
 * - Con saldo suficiente, el cliente elige entre su saldo NovaStore y los métodos externos.
 * - Sin saldo suficiente, la opción de saldo queda bloqueada con el aviso y el acceso a recargar.
 * - El comprobante solo se muestra para métodos externos; el pago con saldo no lo pide.
 */
export default function CheckoutPayment({
  methods,
  balanceCents,
  totalCents,
}: {
  methods: CheckoutMethod[];
  balanceCents: number;
  totalCents: number;
}) {
  const hasBalanceMethod = methods.some((method) => method.code === SALDO_CODE);
  const canPayWithBalance = hasBalanceMethod && balanceCents >= totalCents;
  const externalMethods = methods.filter((method) => method.code !== SALDO_CODE);
  const initialCode = canPayWithBalance
    ? SALDO_CODE
    : externalMethods[0]?.code ?? methods[0]?.code ?? '';
  const [selected, setSelected] = useState(initialCode);
  const payingWithBalance = selected === SALDO_CODE;
  const remainingCents = Math.max(0, balanceCents - totalCents);

  return (
    <>
      <section className="panel p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
          2. Método de pago
        </h2>
        <div className="mt-4 space-y-2.5">
          {methods.map((method) => {
            const isBalance = method.code === SALDO_CODE;
            const blocked = isBalance && !canPayWithBalance;
            return (
              <label
                key={method.id}
                className={`flex items-start gap-3 rounded-xl border border-purple-500/20 bg-black/30 p-3 transition has-checked:border-fuchsia-400/80 has-checked:bg-fuchsia-500/10 ${
                  blocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:border-purple-400/60'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={method.code}
                  checked={selected === method.code}
                  disabled={blocked}
                  onChange={() => setSelected(method.code)}
                  className="mt-1 h-4 w-4 accent-fuchsia-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="block text-sm font-bold text-white">{method.name}</span>
                    {isBalance ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${
                          canPayWithBalance
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                        }`}
                      >
                        Saldo: {formatPEN(balanceCents)}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">{method.description}</span>
                  {isBalance ? (
                    <span className="mt-1 block text-xs text-slate-400">
                      Se descuenta automáticamente al confirmar. No necesitas comprobante.
                    </span>
                  ) : null}
                  {method.account_info && !isBalance ? (
                    <span className="mt-1 block rounded-lg bg-purple-500/10 px-2 py-1 text-xs font-semibold text-purple-200">
                      {method.account_info}
                    </span>
                  ) : null}
                  {method.instructions && !isBalance ? (
                    <span className="mt-1 block text-[0.72rem] leading-relaxed text-slate-500">
                      {method.instructions}
                    </span>
                  ) : null}
                  {blocked ? (
                    <span className="mt-2 block rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs font-semibold text-amber-200">
                      No tienes saldo suficiente para realizar esta compra. Recarga tu saldo para
                      continuar
                      <Link
                        href="/cuenta/saldo"
                        className="mt-1.5 block font-bold text-fuchsia-300 underline decoration-fuchsia-400/50 underline-offset-2"
                      >
                        Ir a Añadir saldo
                      </Link>
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
          {methods.length === 0 ? (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              No hay métodos de pago habilitados. Contacta al administrador de la tienda.
            </p>
          ) : null}
        </div>
      </section>

      {payingWithBalance ? (
        <section className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            3. Pago con saldo NovaStore
          </h2>
          <p className="muted mt-1 text-xs">
            El importe se descuenta de tu saldo en el momento de confirmar. No se solicita
            comprobante ni pago adicional.
          </p>
          <dl className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-purple-500/20 bg-black/30 p-3">
              <dt className="text-[0.7rem] uppercase tracking-[0.12em] text-slate-400">
                Saldo disponible
              </dt>
              <dd className="mt-1 text-sm font-bold text-white">{formatPEN(balanceCents)}</dd>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-black/30 p-3">
              <dt className="text-[0.7rem] uppercase tracking-[0.12em] text-slate-400">
                Total a descontar
              </dt>
              <dd className="mt-1 text-sm font-bold text-fuchsia-300">-{formatPEN(totalCents)}</dd>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <dt className="text-[0.7rem] uppercase tracking-[0.12em] text-slate-400">
                Saldo restante
              </dt>
              <dd className="mt-1 text-sm font-bold text-emerald-300">{formatPEN(remainingCents)}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            3. Comprobante de pago
          </h2>
          <p className="muted mt-1 text-xs">
            Adjunta la captura de tu pago (Yape, Plin o transferencia). Formatos: JPG, PNG, WEBP,
            GIF o PDF. Máximo 5 MB.
          </p>
          <label htmlFor="proof" className="label mt-3">
            Imagen del comprobante
          </label>
          <input
            id="proof"
            name="proof"
            type="file"
            required
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            className="input file:mr-3 file:rounded-lg file:border-0 file:bg-purple-500/25 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-purple-100"
          />
          <p className="mt-2 text-[0.7rem] text-slate-500">
            Tu comprobante solo será visible para ti y para el administrador de la tienda.
          </p>
        </section>
      )}
    </>
  );
}
