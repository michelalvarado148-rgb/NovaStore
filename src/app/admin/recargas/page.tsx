import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime, formatPEN } from '@/lib/format';
import { countPendingRecharges, getAllRecharges, type RechargeStatus } from '@/lib/recharge';
import { reviewRechargeAction } from '@/app/actions/recharge';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recargas | Panel' };

const TABS: { value: RechargeStatus | 'todas'; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobado', label: 'Aprobadas' },
  { value: 'rechazado', label: 'Rechazadas' },
  { value: 'todas', label: 'Todas' },
];

const STATUS: Record<RechargeStatus, { label: string; className: string }> = {
  pendiente: { label: 'En revisión', className: 'badge badge-warning' },
  aprobado: { label: 'Aprobada', className: 'badge badge-success' },
  rechazado: { label: 'Rechazada', className: 'badge badge-danger' },
};

export default async function AdminRechargesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin('/admin/recargas');
  const sp = await searchParams;

  const estado = (TABS.find((t) => t.value === sp.estado)?.value ?? 'pendiente') as
    | RechargeStatus
    | 'todas';
  const rows = getAllRecharges(estado);
  const pending = countPendingRecharges();

  return (
    <div className="space-y-5">
      <div className="panel p-5">
        <h1 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
          Recargas de saldo
        </h1>
        <p className="muted mt-1 text-xs">
          Verifica los comprobantes enviados por los clientes. {pending} solicitud(es) pendiente(s).
        </p>
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

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/recargas?estado=${t.value}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              estado === t.value
                ? 'bg-fuchsia-600 text-white'
                : 'border border-purple-500/25 text-slate-300 hover:bg-purple-500/10 hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <section className="panel overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            No hay solicitudes en esta lista. Cuando un cliente envíe su comprobante aparecerá aquí.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Fecha</th>
                  <th>Comprobante</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = STATUS[r.status];
                  return (
                    <tr key={r.id} className="align-top">
                      <td>
                        <span className="block font-semibold text-white">{r.user_name}</span>
                        <span className="block text-xs text-slate-400">{r.user_email}</span>
                      </td>
                      <td className="font-bold text-fuchsia-200">{formatPEN(r.amount_cents)}</td>
                      <td className="text-sm text-slate-300">
                        {r.method}
                        {r.reference ? (
                          <span className="block text-xs text-slate-500">Op: {r.reference}</span>
                        ) : null}
                      </td>
                      <td className="text-xs text-slate-400">{formatDateTime(r.created_at)}</td>
                      <td>
                        {r.has_proof ? (
                          <a
                            href={`/api/recarga-comprobante/${r.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-fuchsia-300 underline hover:text-fuchsia-200"
                          >
                            Ver imagen
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Sin archivo</span>
                        )}
                        {r.note ? (
                          <span className="mt-1 block max-w-[14rem] text-xs text-slate-500">
                            {r.note}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className={status.className}>{status.label}</span>
                        {r.admin_note ? (
                          <span className="mt-1 block max-w-[12rem] text-xs text-slate-500">
                            {r.admin_note}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {r.status === 'pendiente' ? (
                          <form action={reviewRechargeAction} className="flex flex-col gap-2">
                            <input type="hidden" name="id" value={r.id} />
                            <input
                              name="admin_note"
                              placeholder="Nota (opcional)"
                              className="input w-full text-xs"
                            />
                            <div className="flex gap-2">
                              <button name="action" value="aprobar" className="btn btn-success btn-sm">
                                Aprobar
                              </button>
                              <button name="action" value="rechazar" className="btn btn-danger btn-sm">
                                Rechazar
                              </button>
                            </div>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {r.reviewed_at ? formatDateTime(r.reviewed_at) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
