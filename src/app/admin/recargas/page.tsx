import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime, formatPEN } from '@/lib/format';
import {
  countPendingRecharges,
  getAllRecharges,
  type RechargeStatus,
} from '@/lib/recharge';
import { reviewRechargeAction } from '@/app/actions/recharge';
import { Card, EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Recargas | Panel NOVASTORE' };
export const dynamic = 'force-dynamic';

const TABS: { value: RechargeStatus | 'todas'; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobado', label: 'Aprobadas' },
  { value: 'rechazado', label: 'Rechazadas' },
  { value: 'todas', label: 'Todas' },
];

const STATUS: Record<RechargeStatus, { label: string; tone: string }> = {
  pendiente: { label: 'En revisión', tone: 'badge badge-warning' },
  aprobado: { label: 'Aprobada', tone: 'badge badge-success' },
  rechazado: { label: 'Rechazada', tone: 'badge badge-danger' },
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
    <div className="space-y-6">
      <PageHeader
        title="Recargas de saldo"
        description={`Verifica los comprobantes enviados por los clientes. ${pending} solicitud(es) pendiente(s).`}
      />

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

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="Sin solicitudes"
            description="Cuando un cliente solicite una recarga con su comprobante, aparecerá en esta lista."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-purple-500/15">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Monto</th>
                  <th className="py-2 pr-3">Método</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Comprobante</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = STATUS[r.status];
                  return (
                    <tr key={r.id} className="border-b border-purple-500/10 align-top">
                      <td className="py-3 pr-3">
                        <span className="block font-semibold text-white">{r.user_name}</span>
                        <span className="block text-xs text-slate-400">{r.user_email}</span>
                      </td>
                      <td className="py-3 pr-3 font-semibold text-fuchsia-200">{formatPEN(r.amount_cents)}</td>
                      <td className="py-3 pr-3 text-slate-300">
                        {r.method}
                        {r.reference ? (
                          <span className="block text-xs text-slate-500">Op: {r.reference}</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-400">{formatDateTime(r.created_at)}</td>
                      <td className="py-3 pr-3">
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
                          <span className="mt-1 block max-w-[14rem] text-xs text-slate-500">{r.note}</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">
                        <span className={status.tone}>{status.label}</span>
                        {r.admin_note ? (
                          <span className="mt-1 block max-w-[12rem] text-xs text-slate-500">{r.admin_note}</span>
                        ) : null}
                      </td>
                      <td className="py-3">
                        {r.status === 'pendiente' ? (
                          <form action={reviewRechargeAction} className="flex flex-col gap-2">
                            <input type="hidden" name="id" value={r.id} />
                            <input
                              name="admin_note"
                              placeholder="Nota (opcional)"
                              className="input w-full text-xs"
                            />
                            <div className="flex gap-2">
                              <button name="action" value="aprobar" className="btn btn-primary text-xs">
                                Aprobar
                              </button>
                              <button name="action" value="rechazar" className="btn btn-ghost text-xs">
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
      </Card>
    </div>
  );
}
