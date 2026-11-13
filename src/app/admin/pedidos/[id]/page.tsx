import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderById } from '@/lib/orders';
import { restoreStockAction, updateOrderAction } from '@/app/actions/admin';
import OrderNoticeAnswers from '@/components/OrderNoticeAnswers';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
  formatPEN,
  statusTone,
} from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revisar pedido' };

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const order = getOrderById(Number(id));
  if (!order) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-lg font-black text-white">{order.order_number}</h1>
          <p className="text-xs text-slate-400">Creado el {formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${statusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status]}</span>
          <span className={`badge ${statusTone(order.payment_status)}`}>
            {PAYMENT_STATUS_LABELS[order.payment_status]}
          </span>
          <Link href="/admin/pedidos" className="btn btn-ghost btn-sm">Volver</Link>
        </div>
      </div>

      {query.ok ? <p className="alert alert-ok">{query.ok}</p> : null}
      {query.error ? <p className="alert alert-error">{query.error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="panel p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-purple-300">Productos</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <p className="text-sm text-white">{item.product_name}</p>
                    {item.variant_name ? (
                      <p className="text-[0.7rem] text-slate-500">{item.variant_name}</p>
                    ) : null}
                  </td>
                  <td className="text-slate-300">{item.quantity}</td>
                  <td className="whitespace-nowrap text-slate-300">{formatPEN(item.unit_price_cents)}</td>
                  <td className="whitespace-nowrap font-semibold text-white">
                    {formatPEN(item.unit_price_cents * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between text-slate-400">
              <dt>Subtotal</dt>
              <dd>{formatPEN(order.subtotal_cents)}</dd>
            </div>
            <div className="flex justify-between text-slate-400">
              <dt>Descuento</dt>
              <dd>-{formatPEN(order.discount_cents)}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-1 text-base font-black text-white">
              <dt>Total</dt>
              <dd>{formatPEN(order.total_cents)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
            <p className="text-slate-300"><strong className="text-white">Cliente:</strong> {order.customer_name}</p>
            <p className="text-slate-300"><strong className="text-white">Correo:</strong> {order.contact_email}</p>
            {order.contact_phone ? (
              <p className="text-slate-300"><strong className="text-white">Teléfono:</strong> {order.contact_phone}</p>
            ) : null}
            <p className="text-slate-300"><strong className="text-white">Método de pago:</strong> {order.payment_method}</p>
            {order.customer_note ? (
              <p className="mt-1 text-slate-400">Nota del cliente: {order.customer_note}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <OrderNoticeAnswers orderNumber={order.order_number} />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-white">Comprobante de pago</p>
            {order.proof ? (
              <div className="space-y-2">
                <a
                  href={`/api/comprobante/${order.proof.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  Ver imagen adjunta
                </a>
                <p className="text-[0.7rem] text-slate-500">
                  {order.proof.file_name ?? 'comprobante'} · {(order.proof.size_bytes / 1024).toFixed(0)} KB
                </p>
              </div>
            ) : (
              <p className="text-sm text-amber-300">El cliente aún no adjuntó comprobante.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <form action={updateOrderAction} className="panel space-y-3 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-300">
              Verificación del pedido
            </h2>
            <input type="hidden" name="order_id" value={order.id} />
            <input type="hidden" name="user_id" value={order.user_id} />
            <input type="hidden" name="total_cents" value={order.total_cents} />

            <label className="field">
              <span>Estado del pedido</span>
              <select name="status" defaultValue={order.status}>
                {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Estado del pago</span>
              <select name="payment_status" defaultValue={order.payment_status}>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Nota interna / mensaje al cliente</span>
              <textarea name="admin_note" rows={3} defaultValue={order.admin_note ?? ''} />
            </label>

            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" name="restore_stock" className="mt-0.5" />
              Restaurar stock de los productos de este pedido (si rechazas o cancelas)
            </label>

            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" name="credit_balance" className="mt-0.5" />
              Abonar el total del pedido al saldo del cliente como reembolso
            </label>

            <button type="submit" className="btn btn-primary w-full">Guardar verificación</button>
          </form>

          <form action={restoreStockAction} className="panel p-4">
            <input type="hidden" name="order_id" value={order.id} />
            <p className="mb-2 text-xs text-slate-400">
              Usa esta opción solo si necesitas devolver el stock al catálogo sin cambiar el estado.
            </p>
            <button type="submit" className="btn btn-outline btn-sm w-full">Restaurar stock</button>
          </form>
        </section>
      </div>
    </div>
  );
}
