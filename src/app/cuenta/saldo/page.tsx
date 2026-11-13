import { requireUser } from '@/lib/auth';
import { getBalanceMovements } from '@/lib/orders';
import { formatDateTime, formatPEN } from '@/lib/format';
import {
  RECHARGE_MIN_CENTS,
  getMyRecharges,
  getRechargeMethods,
} from '@/lib/recharge';
import { RechargeAmountField } from '@/components/RechargeAmountField';
import { createRechargeAction } from '@/app/actions/recharge';
import { getPaymentQrUrl } from '@/lib/payment-qr';
import AutoRefresh from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi saldo' };

const RECHARGE_STATUS: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'En revisión', className: 'badge badge-warning' },
  aprobado: { label: 'Aprobada', className: 'badge badge-success' },
  rechazado: { label: 'Rechazada', className: 'badge badge-danger' },
};

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser('/cuenta/saldo');
  const sp = await searchParams;

  const movements = getBalanceMovements(user.id, 200);
  const recharges = getMyRecharges(user.id, 50);
  const methods = getRechargeMethods();
  const credited = movements
    .filter((m) => m.amount_cents > 0)
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const debited = movements
    .filter((m) => m.amount_cents < 0)
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const pending = recharges.filter((r) => r.status === 'pendiente').length;
  const qrUrl = getPaymentQrUrl();

  return (
    <div className="space-y-5">
      {/* El QR se actualiza solo cuando el administrador sube uno nuevo. */}
      <AutoRefresh intervalMs={30000} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel border-purple-400/40 p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-purple-300">
            Saldo disponible
          </p>
          <p className="mt-1 text-3xl font-black text-white">{formatPEN(user.balance_cents)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-300">
            Total acreditado
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-300">{formatPEN(credited)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-red-300">
            Total usado
          </p>
          <p className="mt-1 text-2xl font-black text-red-300">{formatPEN(Math.abs(debited))}</p>
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

      <section id="recarga" className="panel overflow-hidden">
        <div className="border-b border-white/5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Añadir saldo
          </h2>
          <p className="muted mt-1 text-xs">
            Realiza el pago por Yape, Plin o transferencia y envía tu comprobante. El saldo se
            acredita cuando el administrador verifica el pago.
          </p>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-purple-500/25 bg-slate-900/60 p-4">
            {qrUrl ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-2xl bg-white p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl}
                    alt="Código QR para pagar tu recarga de saldo"
                    width={160}
                    height={160}
                    className="h-40 w-40 object-contain"
                  />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-bold text-white">Escanea el QR para pagar</p>
                  <p className="muted mt-1 text-xs">
                    Abre Yape, Plin o la app de tu banco, escanea este código y paga el monto que
                    ingresaste abajo. Después adjunta tu comprobante para que el administrador lo
                    verifique.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-white">
                  El QR de pago todavía no está disponible
                </p>
                <p className="muted mt-1 text-xs">
                  El administrador aún no configuró su QR. Puedes pagar con los datos de los métodos
                  de abajo y adjuntar tu comprobante.
                </p>
              </div>
            )}
          </div>

          {methods.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {methods.map((m) => (
                <div key={m.code} className="rounded-xl border border-purple-500/20 bg-slate-900/60 p-3">
                  <p className="text-sm font-semibold text-white">{m.name}</p>
                  <p className="mt-0.5 text-xs text-slate-300">{m.account_info}</p>
                  {m.instructions ? (
                    <p className="mt-1 text-[0.7rem] text-slate-400">{m.instructions}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted text-sm">
              El administrador aún no habilitó métodos de pago para recargas. Escríbenos por Soporte.
            </p>
          )}

          {pending > 0 ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
              Tienes {pending} solicitud(es) en revisión. Te avisaremos cuando el administrador la
              verifique.
            </p>
          ) : null}

          <form action={createRechargeAction} className="grid gap-3 sm:grid-cols-2">
            <RechargeAmountField minAmount={RECHARGE_MIN_CENTS / 100} />
            <label className="block text-sm text-slate-300">
              Método de pago
              <select name="method" required className="input mt-1.5 w-full">
                <option value="">Selecciona un método</option>
                {methods.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
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
              Comprobante (imagen o PDF)
              <input
                type="file"
                name="proof"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="input mt-1.5 w-full"
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2">
              Nota para el administrador (opcional)
              <textarea
                name="note"
                rows={2}
                maxLength={500}
                placeholder="Ej. Pagué con Yape a nombre de…"
                className="input mt-1.5 w-full resize-y"
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                Enviar solicitud de recarga
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-white/5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Mis solicitudes de recarga
          </h2>
          <p className="muted mt-1 text-xs">Revisa el estado de cada comprobante que enviaste.</p>
        </div>
        {recharges.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aún no enviaste solicitudes de recarga.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Comprobante</th>
                  <th>Estado</th>
                  <th>Respuesta</th>
                </tr>
              </thead>
              <tbody>
                {recharges.map((r) => {
                  const status = RECHARGE_STATUS[r.status];
                  return (
                    <tr key={r.id}>
                      <td className="text-xs text-slate-400">{formatDateTime(r.created_at)}</td>
                      <td className="font-bold text-white">{formatPEN(r.amount_cents)}</td>
                      <td className="text-sm text-slate-300">{r.method}</td>
                      <td className="text-sm">
                        {r.has_proof ? (
                          <a
                            href={`/api/recarga-comprobante/${r.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-fuchsia-300 underline hover:text-fuchsia-200"
                          >
                            Ver
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td>
                        <span className={status.className}>{status.label}</span>
                      </td>
                      <td className="max-w-[14rem] text-xs text-slate-400">
                        {r.admin_note || '—'}
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
            Historial de movimientos
          </h2>
          <p className="muted mt-1 text-xs">
            El saldo lo acredita el administrador luego de verificar tu pago.
          </p>
        </div>
        {movements.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aún no tienes movimientos de saldo.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th>Monto</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="text-xs text-slate-400">{formatDateTime(movement.created_at)}</td>
                    <td className="text-sm text-slate-200">{movement.description}</td>
                    <td
                      className={`font-bold ${
                        movement.amount_cents >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {movement.amount_cents >= 0 ? '+' : ''}
                      {formatPEN(movement.amount_cents)}
                    </td>
                    <td className="text-sm text-white">{movement.type}</td>
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
