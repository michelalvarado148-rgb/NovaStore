import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatDateTime, formatPEN } from '@/lib/format';
import {
  getMyWalletRequests,
  getWalletAccount,
  getWalletConfig,
  listWalletMovements,
} from '@/lib/wallet';
import {
  createWalletRechargeAction,
  createWalletWithdrawalAction,
} from '@/app/actions/wallet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NovaWallet' };

const STATUS: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'badge badge-warning' },
  aprobado: { label: 'Aprobado', className: 'badge badge-success' },
  rechazado: { label: 'Rechazado', className: 'badge badge-danger' },
};

const KIND_LABEL: Record<string, string> = {
  recarga: 'Recarga',
  retiro: 'Retiro',
};

/* Iconos en línea: trazo fino y consistente con el resto de la tienda. */

function WalletIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1.5" />
      <path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5.5a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5Z" />
      <path d="M17.5 13.5h.01" />
    </svg>
  );
}

function PlusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowUpIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

function ArrowDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

function QrIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
      <path d="M8.5 8.5h1.5v1.5H8.5zM14 8.5h1.5V10H14zM8.5 14H10v1.5H8.5zM14 14h1.5v1.5H14z" />
    </svg>
  );
}

function ClockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5l3 1.8" />
    </svg>
  );
}

function ShieldIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3.5 5 6.5v5c0 4 3 7.4 7 9 4-1.6 7-5 7-9v-5l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function InfoIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export default async function NovaWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser('/extra/novawallet');
  const sp = await searchParams;

  const config = getWalletConfig();
  const account = getWalletAccount(user.id);
  const requests = getMyWalletRequests(user.id, 50);
  const movements = listWalletMovements(user.id, 200);

  const credited = movements
    .filter((m) => m.amount_cents > 0)
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const withdrawn = movements
    .filter((m) => m.amount_cents < 0)
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const pending = requests.filter((r) => r.status === 'pendiente').length;

  const feeParts: string[] = [];
  if (config.fee_enabled) {
    if (config.fee_percent > 0) feeParts.push(`${config.fee_percent}%`);
    if (config.fee_fixed_cents > 0) feeParts.push(formatPEN(config.fee_fixed_cents));
  }
  const feeText = feeParts.length > 0 ? feeParts.join(' + ') : '';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3.5 pb-4">
      {/* 1. Encabezado compacto con el estado de la billetera */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-600/40 to-fuchsia-600/10 text-purple-200">
            <WalletIcon />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-purple-300/80">
              Billetera digital
            </p>
            <h1 className="truncate text-lg font-black text-white">NovaWallet</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={pending > 0 ? 'badge badge-warning' : 'badge badge-success'}>
            {pending > 0 ? `${pending} pendiente${pending === 1 ? '' : 's'}` : 'Activa'}
          </span>
          <Link href="/extra" className="btn btn-ghost btn-sm" aria-label="Volver a EXTRA">
            ←
          </Link>
        </div>
      </header>

      {sp.ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {sp.ok}
        </p>
      ) : null}
      {sp.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {sp.error}
        </p>
      ) : null}

      {/* 2. Tarjeta principal del saldo */}
      <section className="relative overflow-hidden rounded-3xl border border-purple-400/25 bg-gradient-to-br from-[#3b1d6e] via-[#1d1035] to-[#0a0614] p-4 shadow-[0_16px_40px_-28px_rgba(168,85,247,0.9)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-fuchsia-500/25 blur-2xl"
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-purple-200/80">
              Saldo disponible
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[0.58rem] font-semibold text-purple-100">
              <ShieldIcon /> Independiente
            </span>
          </div>
          <p className="mt-1 text-[2rem] font-black leading-none tracking-tight text-white">
            {formatPEN(account.balance_cents)}
          </p>
          <p className="mt-1.5 text-[0.66rem] leading-snug text-purple-200/70">
            Solo para NovaWallet: no se usa para comprar en la tienda ni se mezcla con tu saldo de
            compras.
          </p>
        </div>
      </section>

      {/* 3. Dos acciones principales */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href="#recarga"
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3 py-3 text-sm font-bold text-white shadow-[0_10px_24px_-16px_rgba(168,85,247,0.95)] transition active:scale-[0.99]"
        >
          <PlusIcon /> Agregar dinero
        </a>
        <a
          href="#retiro"
          className="flex items-center justify-center gap-2 rounded-2xl border border-purple-400/40 bg-purple-500/10 px-3 py-3 text-sm font-bold text-purple-100 transition active:scale-[0.99]"
        >
          <ArrowUpIcon /> Retirar dinero
        </a>
      </div>

      {/* 4. Totales de la alcancía */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/10 bg-[#0d0a18]/80 p-3">
          <p className="flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-emerald-300/90">
            <ArrowDownIcon className="h-3 w-3" /> Total ingresado
          </p>
          <p className="mt-1 text-base font-black text-emerald-300">{formatPEN(credited)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0d0a18]/80 p-3">
          <p className="flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-rose-300/90">
            <ArrowUpIcon className="h-3 w-3" /> Total retirado
          </p>
          <p className="mt-1 text-base font-black text-rose-300">{formatPEN(Math.abs(withdrawn))}</p>
        </div>
      </div>

      {/* 5. Comisiones y condiciones, en un aviso pequeño */}
      <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[0.66rem] leading-snug text-slate-400">
        <InfoIcon className="mt-0.5 shrink-0 text-purple-300" />
        <span>
          Recarga mínima {formatPEN(config.min_recharge_cents)} · Retiro mínimo{' '}
          {formatPEN(config.min_withdraw_cents)} ·{' '}
          {config.fee_enabled && feeText
            ? `comisión de retiro ${feeText}`
            : 'sin comisión de retiro'}
          . Tu saldo cambia solo cuando el administrador aprueba la operación.
        </span>
      </p>

      {config.notice ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[0.68rem] leading-snug text-amber-100">
          {config.notice}
        </p>
      ) : null}

      {/* 6. Últimos movimientos */}
      <section id="movimientos" className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-purple-200">
            <ClockIcon className="h-3.5 w-3.5" /> Últimos movimientos
          </h2>
          <span className="text-[0.58rem] uppercase tracking-[0.1em] text-slate-500">
            {movements.length} registro{movements.length === 1 ? '' : 's'}
          </span>
        </div>
        {movements.length === 0 ? (
          <p className="px-4 py-5 text-xs leading-snug text-slate-400">
            Aún no tienes movimientos. Cuando el administrador apruebe una recarga o un retiro,
            aparecerá aquí.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {movements.map((movement) => {
              const isIncome = movement.amount_cents >= 0;
              return (
                <li key={movement.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      isIncome ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {isIncome ? <ArrowDownIcon /> : <ArrowUpIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.78rem] font-semibold text-slate-100">
                      {movement.description}
                    </p>
                    <p className="text-[0.6rem] text-slate-500">
                      {formatDateTime(movement.created_at)} ·{' '}
                      {movement.kind === 'ingreso' ? 'Ingreso' : 'Retiro'}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-bold ${
                      isIncome ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {isIncome ? '+' : ''}
                    {formatPEN(movement.amount_cents)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 7. Agregar dinero con el QR del administrador */}
      <section id="recarga" className="panel scroll-mt-24 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <QrIcon className="shrink-0 text-purple-300" />
          <div className="min-w-0">
            <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-purple-200">
              Agregar dinero con QR
            </h2>
            <p className="text-[0.64rem] leading-snug text-slate-400">
              Escanea el QR, paga y sube la foto de tu comprobante.
            </p>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-2xl border border-purple-500/25 bg-[#120c22]/80 p-3">
            {config.qr_url ? (
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-xl bg-white p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={config.qr_url}
                    alt="QR de pago de NovaWallet"
                    className="h-28 w-28 object-contain sm:h-32 sm:w-32"
                  />
                </div>
                <ol className="min-w-0 flex-1 space-y-1 text-[0.68rem] leading-snug text-slate-300">
                  <li>
                    <span className="font-bold text-purple-200">1.</span> Abre Yape o Plin y
                    escanea el QR.
                  </li>
                  <li>
                    <span className="font-bold text-purple-200">2.</span> Paga el monto que quieres
                    agregar{config.yape_holder ? ` a nombre de ${config.yape_holder}` : ''}.
                  </li>
                  <li>
                    <span className="font-bold text-purple-200">3.</span> Registra el monto y sube
                    tu comprobante aquí abajo.
                  </li>
                </ol>
              </div>
            ) : config.yape_number ? (
              <div>
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-purple-300">
                  Yape · el QR todavía no está configurado
                </p>
                <p className="mt-0.5 text-lg font-black tracking-wide text-white">
                  {config.yape_number}
                </p>
                {config.yape_holder ? (
                  <p className="text-[0.66rem] text-slate-300">{config.yape_holder}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs leading-snug text-amber-200">
                El administrador todavía no configuró su QR de pago. Escríbenos por Soporte.
              </p>
            )}
          </div>

          <form action={createWalletRechargeAction} className="grid gap-2.5 sm:grid-cols-2">
            <label className="block text-[0.72rem] text-slate-300">
              Monto pagado (S/)
              <input
                type="number"
                name="amount"
                min={config.min_recharge_cents / 100}
                step="0.01"
                required
                inputMode="decimal"
                placeholder="20.00"
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-[0.72rem] text-slate-300">
              N° de operación (opcional)
              <input
                type="text"
                name="reference"
                maxLength={60}
                placeholder="Ej. 0123456"
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-[0.72rem] text-slate-300 sm:col-span-2">
              Comprobante (JPG, PNG o WEBP)
              <input
                type="file"
                name="proof"
                required
                accept="image/jpeg,image/png,image/webp"
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-[0.72rem] text-slate-300 sm:col-span-2">
              Nota para el administrador (opcional)
              <textarea
                name="note"
                rows={2}
                maxLength={300}
                placeholder="Ej. Pagué con el QR a nombre de…"
                className="input mt-1 w-full resize-y"
              />
            </label>
            <button type="submit" className="btn btn-primary w-full sm:col-span-2">
              Enviar comprobante
            </button>
          </form>
        </div>
      </section>

      {/* 8. Retirar dinero */}
      <section id="retiro" className="panel scroll-mt-24 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <ArrowUpIcon className="shrink-0 text-purple-300" />
          <div className="min-w-0">
            <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-purple-200">
              Retirar dinero
            </h2>
            <p className="text-[0.64rem] leading-snug text-slate-400">
              Se descuenta de tu saldo cuando el administrador aprueba la solicitud.
            </p>
          </div>
        </div>

        <div className="p-4">
          <form action={createWalletWithdrawalAction} className="grid gap-2.5 sm:grid-cols-2">
            <label className="block text-[0.72rem] text-slate-300">
              Monto a retirar (S/)
              <input
                type="number"
                name="amount"
                min={config.min_withdraw_cents / 100}
                max={account.balance_cents / 100}
                step="0.01"
                required
                inputMode="decimal"
                placeholder="10.00"
                className="input mt-1 w-full"
              />
            </label>
            <label className="block text-[0.72rem] text-slate-300">
              ¿Cómo quieres recibirlo?
              <select name="method" required className="input mt-1 w-full">
                <option value="Yape">Yape</option>
                <option value="Plin">Plin</option>
                <option value="Transferencia">Transferencia bancaria</option>
              </select>
            </label>
            <label className="block text-[0.72rem] text-slate-300 sm:col-span-2">
              Número o cuenta de destino
              <textarea
                name="note"
                rows={2}
                maxLength={300}
                required
                placeholder="Ej. Yape 987 654 321 a nombre de…"
                className="input mt-1 w-full resize-y"
              />
            </label>
            <button type="submit" className="btn btn-outline w-full sm:col-span-2">
              Solicitar retiro
            </button>
          </form>
        </div>
      </section>

      {/* 9. Estado de las solicitudes */}
      <section id="solicitudes" className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
          <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-purple-200">
            Mis solicitudes
          </h2>
          <span className="text-[0.58rem] uppercase tracking-[0.1em] text-slate-500">
            {requests.length} en total
          </span>
        </div>
        {requests.length === 0 ? (
          <p className="px-4 py-5 text-xs leading-snug text-slate-400">
            Aún no tienes solicitudes en NovaWallet.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {requests.map((request) => {
              const status = STATUS[request.status];
              return (
                <li key={request.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[0.78rem] font-semibold text-white">
                      {KIND_LABEL[request.kind]} · {formatPEN(request.amount_cents)}
                    </p>
                    <span className={status.className}>{status.label}</span>
                  </div>
                  <p className="mt-0.5 text-[0.6rem] leading-snug text-slate-500">
                    {formatDateTime(request.created_at)}
                    {request.kind === 'retiro' && request.fee_cents > 0
                      ? ` · comisión ${formatPEN(request.fee_cents)} · recibes ${formatPEN(
                          request.net_cents,
                        )}`
                      : ''}
                  </p>
                  {request.admin_note ? (
                    <p className="mt-1 text-[0.66rem] leading-snug text-slate-400">
                      Respuesta: {request.admin_note}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
