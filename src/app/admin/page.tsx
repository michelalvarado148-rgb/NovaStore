import Link from 'next/link';
import { getAdminOrders, getDashboardStats, getPendingProofs } from '@/lib/orders';
import { formatDateTime, formatPEN, statusTone, ORDER_STATUS_LABELS } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resumen de ventas' };

export default function AdminDashboard() {
  const stats = getDashboardStats();
  const pending = getPendingProofs().slice(0, 5);
  const latest = getAdminOrders({ limit: 6 });
  const maxDay = Math.max(1, ...stats.last7Days.map((day) => day.total));

  const cards = [
    { label: 'Ventas de hoy', value: formatPEN(stats.salesTodayCents) },
    { label: 'Ventas del mes', value: formatPEN(stats.salesMonthCents) },
    { label: 'Ventas verificadas', value: formatPEN(stats.salesTotalCents) },
    { label: 'Pedidos totales', value: String(stats.ordersTotal) },
    { label: 'Pedidos pendientes', value: String(stats.ordersPending) },
    { label: 'Comprobantes por verificar', value: String(stats.proofsPending) },
    { label: 'Clientes registrados', value: String(stats.customers) },
    { label: 'Productos con stock bajo', value: String(stats.lowStock) },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="panel p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-purple-300">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-black text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Ventas de los últimos 7 días
          </h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {stats.last7Days.map((day) => (
              <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-full w-full items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-violet-600 to-fuchsia-400 transition-all"
                    style={{ height: `${Math.max(4, (day.total / maxDay) * 100)}%` }}
                    title={formatPEN(day.total)}
                  />
                </div>
                <span className="text-[0.6rem] text-slate-500">{day.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Productos más vendidos
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Aún no hay ventas registradas.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stats.topProducts.map((product) => (
                <li
                  key={product.product_name}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <span className="truncate text-sm text-slate-200">{product.product_name}</span>
                  <span className="ml-2 shrink-0 text-xs text-purple-300">
                    {product.units} u. · {formatPEN(product.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Comprobantes pendientes
            </h2>
            <Link href="/admin/comprobantes" className="text-xs font-semibold text-purple-300">
              Ver todos →
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-400">No hay comprobantes por verificar.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/pedidos/${order.id}`}
                    className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 hover:border-amber-400/60"
                  >
                    <span className="font-mono text-xs text-white">{order.order_number}</span>
                    <span className="text-xs text-amber-200">
                      {order.customer_name} · {formatPEN(order.total_cents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Últimos pedidos
            </h2>
            <Link href="/admin/pedidos" className="text-xs font-semibold text-purple-300">
              Gestionar →
            </Link>
          </div>
          <ul className="space-y-2">
            {latest.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/pedidos/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 hover:border-purple-400/50"
                >
                  <div>
                    <p className="font-mono text-xs text-white">{order.order_number}</p>
                    <p className="text-[0.65rem] text-slate-500">{formatDateTime(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${statusTone(order.status)}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <span className="text-xs font-bold text-white">{formatPEN(order.total_cents)}</span>
                  </div>
                </Link>
              </li>
            ))}
            {latest.length === 0 ? <p className="text-sm text-slate-400">Sin pedidos aún.</p> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
