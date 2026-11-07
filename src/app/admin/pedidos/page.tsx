import Link from 'next/link';
import { getAdminOrders } from '@/lib/orders';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
  formatPEN,
  statusTone,
} from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gestión de pedidos' };

const STATUS_FILTERS = ['todos', 'pendiente', 'en_proceso', 'entregado', 'rechazado', 'cancelado'];
const PAYMENT_FILTERS = ['todos', 'pendiente', 'verificado', 'rechazado'];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; pago?: string; q?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const status = params.estado ?? 'todos';
  const paymentStatus = params.pago ?? 'todos';
  const orders = getAdminOrders({ status, paymentStatus, search: params.q });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">Pedidos ({orders.length})</h1>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <form className="panel flex flex-wrap items-end gap-2 p-4">
        <label className="field">
          <span>Buscar</span>
          <input name="q" defaultValue={params.q ?? ''} placeholder="N° pedido, cliente o correo" />
        </label>
        <label className="field">
          <span>Estado</span>
          <select name="estado" defaultValue={status}>
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === 'todos' ? 'Todos' : ORDER_STATUS_LABELS[value as keyof typeof ORDER_STATUS_LABELS]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Pago</span>
          <select name="pago" defaultValue={paymentStatus}>
            {PAYMENT_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === 'todos' ? 'Todos' : PAYMENT_STATUS_LABELS[value as keyof typeof PAYMENT_STATUS_LABELS]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary btn-sm">Filtrar</button>
      </form>

      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Pago</th>
              <th>Comprobante</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <p className="font-mono text-xs text-white">{order.order_number}</p>
                  <p className="text-[0.65rem] text-slate-500">{formatDateTime(order.created_at)}</p>
                </td>
                <td>
                  <p className="text-sm text-slate-200">{order.customer_name}</p>
                  <p className="text-[0.65rem] text-slate-500">{order.customer_email}</p>
                </td>
                <td className="whitespace-nowrap font-semibold text-white">{formatPEN(order.total_cents)}</td>
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
                <td>
                  {order.has_proof ? (
                    <span className="badge badge-info">Adjunto</span>
                  ) : (
                    <span className="badge badge-muted">Sin imagen</span>
                  )}
                </td>
                <td className="text-right">
                  <Link href={`/admin/pedidos/${order.id}`} className="btn btn-ghost btn-xs">
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                  No hay pedidos con esos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
