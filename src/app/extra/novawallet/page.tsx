import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatDateTime, formatPEN } from '@/lib/format';
import {
  getMyWalletRequests,
  getWalletAccount,
  getWalletConfig,
  listWalletMovements,
  walletFeeCents,
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
    <div className="space-y-5">
      <div className="panel overflow-hidden">
        <div className="border-b border-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-purple-300">
                Sección EXTRA
              </p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-white">
                <span aria-hidden>👛</span> NovaWallet
              </h1>
            </div>
            <Link href="/extra" className="btn btn-ghost btn-sm">
              ← Volver a EXTRA
            </Link>
          </div>
          <p className="muted mt-2 text-xs">
            Alcancía digital independiente. Este dinero no se usa para comprar productos en
            NOVASTORE y no se mezcla con tu saldo de compras.
          </p>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-purple-400/40 bg-purple-500/10 p-4">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-purple-200">
              Saldo en NovaWallet
            </p>
            <p className="mt-1 text-3xl font-black text-white">{formatPEN(account.balance_cents)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Total ingresado
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-300">{formatPEN(credited)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-red-300">
              Total retirado
            </p>
            <p className="mt-1 text-2xl font-black text-red-300">
              {formatPEN(Math.abs(withdrawn))}
            </p>
          </div>
        </div>
      </div>

      {sp.ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {sp.ok}
        </p>
      ) : null}
      {sp.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {sp.error}
        </p>
      ) : null}

      {config.notice ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {config.notice}
        </p>
      ) : null}

      {pending > 0 ? (
        <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-100">
          Tienes {pending} solicitud(es) pendientes de revisión. Tu saldo cambia solo cuando el
          administrador confirma la operación.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section id="recarga" className="panel overflow-hidden">
          <div className="border-b border-white/5 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Agregar dinero por Yape
            </h2>
            <p className="muted mt-1 text-xs">
              Envía tu dinero por Yape y registra el monto con la foto de tu comprobante.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-purple-500/25 bg-slate-900/60 p-4">
              {config.yape_number ? (
                <>
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-purple-300">
                    Yape
                  </p>
                  <p className="mt-1 text-xl font-black tracking-wide text-white">
                    {config.yape_number}
                  </p>
                  {config.yape_holder ? (
                    <p className="mt-0.5 text-xs text-slate-300">{config.yape_holder}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-amber-200">
                  El administrador todavía no configuró su número de Yape. Escríbenos por Soporte.
                </p>
              )}
              <p className="muted mt-2 text-[0.7rem]">
                Monto mínimo: {formatPEN(config.min_recharge_cents)}
              </p>
            </div>

            <form action={createWalletRechargeAction} className="grid gap-3">
              <label className="block text-sm text-slate-300">
                Monto enviado (S/)
                <input
                  type="number"
                  name="amount"
                  min={config.min_recharge_cents / 100}
                  step="0.01"
                  required
                  inputMode="decimal"
                  placeholder="20.00"
                  className="input mt-1.5 w-full"
                />
              </label>
              <label className="block text-sm text-slate-300">
                N° de operación (opcional)
                <input
                  type="text"
                  name="reference"
                  maxLength={60}
                  placeholder="Ej. 0123456"
                  className="input mt-1.5 w-full"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Comprobante (JPG, PNG o WEBP)
                <input
                  type="file"
                  name="proof"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  className="input mt-1.5 w-full"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Nota para el administrador (opcional)
                <textarea
                  name="note"
                  rows={2}
                  maxLength={300}
                  placeholder="Ej. Envié el Yape a nombre de…"
                  className="input mt-1.5 w-full resize-y"
                />
              </label>
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                Enviar comprobante
              </button>
            </form>
          </div>
        </section>

        <section id="retiro" className="panel overflow-hidden">
          <div className="border-b border-white/5 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Solicitar retiro
            </h2>
            <p className="muted mt-1 text-xs">
              Pide retirar tu saldo. Se descuenta cuando el administrador aprueba la solicitud.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300">
              <p>Monto mínimo de retiro: {formatPEN(config.min_withdraw_cents)}</p>
              <p className="mt-1">
                {config.fee_enabled && feeText
                  ? `Comisión de retiro: ${feeText} (se descuenta del monto solicitado).`
                  : 'Sin comisión de retiro por ahora.'}
              </p>
              <p className="mt-1 text-slate-400">
                Saldo disponible: {formatPEN(account.balance_cents)}
              </p>
            </div>

            <form action={createWalletWithdrawalAction} className="grid gap-3">
              <label className="block text-sm text-slate-300">
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
                  className="input mt-1.5 w-full"
                />
              </label>
              <label className="block text-sm text-slate-300">
                ¿Cómo quieres recibirlo?
                <select name="method" required className="input mt-1.5 w-full">
                  <option value="Yape">Yape</option>
                  <option value="Plin">Plin</option>
                  <option value="Transferencia">Transferencia bancaria</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Número o cuenta de destino
                <textarea
                  name="note"
                  rows={2}
                  maxLength={300}
                  required
                  placeholder="Ej. Yape 987 654 321 a nombre de…"
                  className="input mt-1.5 w-full resize-y"
                />
              </label>
              <button type="submit" className="btn btn-outline w-full sm:w-auto">
                Solicitar retiro
              </button>
            </form>
          </div>
        </section>
      </div>

      <section id="solicitudes" className="panel overflow-hidden">
        <div className="border-b border-white/5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Estado de mis solicitudes
          </h2>
          <p className="muted mt-1 text-xs">
            Recargas y retiros de NovaWallet con la respuesta del administrador.
          </p>
        </div>
        {requests.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aún no tienes solicitudes en NovaWallet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Comisión</th>
                  <th>Estado</th>
                  <th>Respuesta</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const status = STATUS[request.status];
                  return (
                    <tr key={request.id}>
                      <td className="text-xs text-slate-400">
                        {formatDateTime(request.created_at)}
                      </td>
                      <td className="text-sm text-white">{KIND_LABEL[request.kind]}</td>
                      <td className="font-bold text-white">{formatPEN(request.amount_cents)}</td>
                      <td className="text-xs text-slate-300">
                        {request.kind === 'retiro' && request.fee_cents > 0
                          ? `${formatPEN(request.fee_cents)} · recibes ${formatPEN(request.net_cents)}`
                          : '—'}
                      </td>
                      <td>
                        <span className={status.className}>{status.label}</span>
                      </td>
                      <td className="max-w-[14rem] text-xs text-slate-400">
                        {request.admin_note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-white/5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Movimientos de NovaWallet
          </h2>
          <p className="muted mt-1 text-xs">
            Solo aparecen movimientos aprobados por el administrador.
          </p>
        </div>
        {movements.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aún no tienes movimientos en tu alcancía.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Detalle</th>
                  <th>Monto</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="text-xs text-slate-400">
                      {formatDateTime(movement.created_at)}
                    </td>
                    <td className="text-sm text-slate-200">{movement.description}</td>
                    <td
                      className={`font-bold ${
                        movement.amount_cents >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {movement.amount_cents >= 0 ? '+' : ''}
                      {formatPEN(movement.amount_cents)}
                    </td>
                    <td className="text-sm text-white">
                      {movement.kind === 'ingreso' ? 'Ingreso' : 'Retiro'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
