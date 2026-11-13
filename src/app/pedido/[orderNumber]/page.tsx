import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getOrderForUser } from '@/lib/orders';
import OrderNoticeAnswers from '@/components/OrderNoticeAnswers';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
  formatPEN,
  statusTone,
} from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle del pedido' };

const STEPS = ['pendiente', 'en_proceso', 'entregado'] as const;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const user = await requireUser('/cuenta/pedidos');
  const { orderNumber } = await params;
  const { nuevo } = await searchParams;
  const order = getOrderForUser(orderNumber, user.id);
  if (!order) notFound();

  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <div className="shell py-8">
      <nav className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/cuenta" className="hover:text-purple-300">Mi cuenta</Link>
        <span>/</span>
        <Link href="/cuenta/pedidos" className="hover:text-purple-300">Pedidos</Link>
        <span>/</span>
        <span className="text-slate-300">{order.order_number}</span>
      </nav>

      {nuevo ? (
        <div className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="font-bold text-emerald-200">¡Pedido registrado correctamente!</p>
          <p className="mt-1 text-sm text-emerald-100/80">
            {order.payment_method === 'saldo' ? (
              <>
                Tu compra fue pagada con tu <strong>saldo NovaStore</strong> y el importe ya se
                descontó de tu cuenta. Guarda tu número de pedido: {order.order_number}.
              </>
            ) : (
              <>
                Tu pedido quedó <strong>pendiente de verificación</strong>. Revisaremos tu
                comprobante y actualizaremos el estado. Guarda tu número de pedido:{' '}
                {order.order_number}.
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="panel p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-300">
              Pedido
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white">{order.order_number}</h1>
            <p className="muted mt-1 text-xs">Creado el {formatDateTime(order.created_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`badge ${statusTone(order.status)}`}>
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
            <span className={`badge ${statusTone(order.payment_status)}`}>
              Pago: {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
            </span>
          </div>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const active = stepIndex >= index && order.status !== 'rechazado' && order.status !== 'cancelado';
            return (
              <li
                key={step}
                className={`rounded-xl border p-3 ${
                  active
                    ? 'border-purple-400/60 bg-purple-500/10'
                    : 'border-white/8 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[0.7rem] font-bold ${
                      active ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-400'}`}>
                    {ORDER_STATUS_LABELS[step]}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {order.status === 'rechazado' || order.status === 'cancelado' ? (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            Este pedido fue {ORDER_STATUS_LABELS[order.status].toLowerCase()}.
            {order.admin_note ? ` Motivo: ${order.admin_note}` : ' Contacta al soporte para más información.'}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Productos
            </h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Cant.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-semibold text-white">{item.product_name}</span>
                        {item.variant_name ? (
                          <span className="block text-xs text-purple-300">{item.variant_name}</span>
                        ) : null}
                      </td>
                      <td>{formatPEN(item.unit_price_cents)}</td>
                      <td>{item.quantity}</td>
                      <td className="font-semibold text-white">{formatPEN(item.line_total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel-flat mt-4 p-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-purple-200">
                Datos de contacto
              </h3>
              <p className="mt-2 text-sm text-slate-300">{order.contact_email}</p>
              <p className="text-sm text-slate-300">{order.contact_phone ?? 'Sin teléfono'}</p>
              {order.customer_note ? (
                <p className="mt-2 text-xs text-slate-400">Nota: {order.customer_note}</p>
              ) : null}
            </div>

            <OrderNoticeAnswers orderNumber={order.order_number} />
          </div>

          <aside className="space-y-3">
            <div className="panel-flat p-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-purple-200">
                Resumen
              </h3>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <dt>Subtotal</dt>
                  <dd>{formatPEN(order.subtotal_cents)}</dd>
                </div>
                {order.discount_cents > 0 ? (
                  <div className="flex justify-between text-emerald-300">
                    <dt>Descuento</dt>
                    <dd>-{formatPEN(order.discount_cents)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-white/10 pt-1.5">
                  <dt className="font-bold text-white">Total</dt>
                  <dd className="text-lg font-black text-white">{formatPEN(order.total_cents)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-slate-400">
                Método de pago: <strong className="text-slate-200">{order.payment_method}</strong>
              </p>
            </div>

            <div className="panel-flat p-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-purple-200">
                {order.payment_method === 'saldo' ? 'Pago' : 'Comprobante'}
              </h3>
              {order.payment_method === 'saldo' ? (
                <p className="mt-2 text-sm text-emerald-200">
                  Pagado con saldo NovaStore. No se requiere comprobante para este pedido.
                </p>
              ) : order.proof ? (
                <>
                  <a
                    href={`/api/comprobante/${order.proof.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block overflow-hidden rounded-lg border border-purple-500/30"
                  >
                    {order.proof.mime_type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/comprobante/${order.proof.id}`}
                        alt="Comprobante de pago"
                        className="max-h-56 w-full object-contain"
                      />
                    ) : (
                      <span className="block p-4 text-sm text-purple-200">
                        Ver comprobante adjunto ({order.proof.file_name})
                      </span>
                    )}
                  </a>
                  <p className="mt-1 text-[0.7rem] text-slate-500">
                    Solo tú y el administrador pueden ver este archivo.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-amber-200">Sin comprobante adjunto.</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/cuenta/pedidos" className="btn btn-outline btn-sm">Ver todos mis pedidos</Link>
              <Link href="/productos" className="btn btn-ghost btn-sm">Seguir comprando</Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
