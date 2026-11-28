import { requireUser } from '@/lib/auth';
import { getBalanceMovements } from '@/lib/orders';
import { formatDateTime, formatPEN } from '@/lib/format';
import {
  RECHARGE_MIN_CENTS,
  getMyRecharges,
  getRechargeMethods,
} from '@/lib/recharge';
import { RechargeFlow } from '@/components/RechargeFlow';
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

      <div className="ns-bal-grid">
        <div className="ns-bal-card is-primary">
          <span className="ns-bal-label">Saldo disponible</span>
          <strong className="ns-bal-value">{formatPEN(user.balance_cents)}</strong>
          <span className="ns-bal-foot">Listo para usar en tus compras de NovaStore</span>
        </div>
        <div className="ns-bal-card">
          <span className="ns-bal-label is-green">Total acreditado</span>
          <strong className="ns-bal-value">{formatPEN(credited)}</strong>
          <span className="ns-bal-foot">Recargas aprobadas</span>
        </div>
        <div className="ns-bal-card">
          <span className="ns-bal-label is-red">Total usado</span>
          <strong className="ns-bal-value">{formatPEN(Math.abs(debited))}</strong>
          <span className="ns-bal-foot">Compras pagadas con saldo</span>
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

      <RechargeFlow
        minAmount={RECHARGE_MIN_CENTS / 100}
        qrUrl={qrUrl}
        methods={methods}
        pending={pending}
      />

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
