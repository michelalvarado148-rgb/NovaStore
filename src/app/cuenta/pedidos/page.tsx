import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUserOrders } from '@/lib/orders';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
  formatPEN,
  statusTone,
} from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mis pedidos' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const user = await requireUser('/cuenta/pedidos');
  const { estado } = await searchParams;
  const all = getUserOrders(user.id);
  const orders = estado && estado !== 'todos' ? all.filter((o) => o.status === estado) : all;

  const filters = [
    { value: 'todos', label: 'Todos' },
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'entregado', label: 'Entregados' },
    { value: 'rechazado', label: 'Rechazados' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black tracking-tight text-white">Historial de pedidos</h1>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Link
              key={filter.value}
              href={`/cuenta/pedidos?estado=${filter.value}`}
              className={`chip ${(estado ?? 'todos') === filter.value ? 'chip-active' : ''}`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-slate-400">No hay pedidos en esta categoría.</p>
          <Link href="/productos" className="btn btn-primary btn-sm mt-4">Ir al catálogo</Link>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Pago</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono text-xs font-bold text-white">{order.order_number}</td>
                    <td className="text-xs text-slate-400">{formatDateTime(order.created_at)}</td>
                    <td>
                      <span className={`badge ${statusTone(order.status)}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusTone(order.payment_status)}`}>
                        {PAYMENT_STATUS_LABELS[order.payment_status]}
                      </span>
                    </td>
                    <td className="font-bold text-white">{formatPEN(order.total_cents)}</td>
                    <td className="text-right">
                      <Link href={`/pedido/${order.order_number}`} className="btn btn-outline btn-xs">
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
