import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getOrderForUser } from '@/lib/orders';
import { getOrderDelivery, getPurchaseMeta } from '@/lib/deliveries';
import { deliveryKindMeta } from '@/lib/delivery-kinds';
import { ORDER_STATUS_LABELS, formatDateTime, formatPEN, statusTone } from '@/lib/format';
import CopyValue from '@/components/CopyValue';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Datos de mi compra' };

/**
 * Datos entregados por el administrador para un pedido del cliente autenticado.
 * Solo el dueño del pedido puede abrir esta página y solo cuando está entregado.
 */
export default async function OrderDeliveryPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await requireUser(`/pedido/${orderNumber}/entrega`);
  const order = getOrderForUser(orderNumber, user.id);
  if (!order) notFound();

  const delivery = getOrderDelivery(order.id);
  const meta = getPurchaseMeta([order.id]).get(order.id);
  const released = order.status === 'entregado' && delivery !== null;

  return (
    <div className="shell max-w-2xl space-y-4 py-6">
      <Link href="/cuenta/pedidos" className="text-xs font-semibold text-purple-300">
        ← Volver a Mis compras
      </Link>

      <div className="panel p-4">
        <div className="flex items-center gap-3">
          {meta?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.imageUrl}
              alt={meta.name}
              className="h-16 w-16 shrink-0 rounded-xl border border-purple-500/25 object-cover"
            />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-purple-500/10 text-2xl">
              📦
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{meta?.name ?? 'Tu compra'}</p>
            <p className="font-mono text-xs text-purple-300">#{order.order_number}</p>
            <p className="text-[0.7rem] text-slate-400">
              {formatDateTime(order.created_at)} · {formatPEN(order.total_cents)}
            </p>
          </div>
          <span className={`badge ${statusTone(order.status)}`}>
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
      </div>

      {!released || !delivery ? (
        <div className="panel p-6 text-center">
          <p className="text-3xl">⏳</p>
          <p className="mt-2 text-sm font-semibold text-white">
            Tu pedido aún no tiene datos de entrega
          </p>
          <p className="mt-1 text-xs text-slate-400">
            En cuanto el administrador entregue tu producto, aquí verás los datos con un botón para
            copiar cada uno.
          </p>
        </div>
      ) : (
        <>
          <section className="panel p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-purple-300">
              Datos entregados
            </h2>
            <ul className="space-y-2">
              {delivery.fields.map((field, index) => {
                const kind = deliveryKindMeta(field.kind);
                return (
                  <li
                    key={`${field.label}-${index}`}
                    className="rounded-xl border border-purple-500/20 bg-black/30 p-3"
                  >
                    <p className="text-[0.65rem] uppercase tracking-[0.12em] text-purple-300">
                      {kind.icon} {field.label}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="min-w-0 break-all font-mono text-xs text-white">{field.value}</p>
                      <CopyValue value={field.value} label={field.label} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {delivery.instructions ? (
            <section className="panel p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-purple-300">
                Instrucciones de uso
              </h2>
              <p className="whitespace-pre-line text-xs leading-relaxed text-slate-300">
                {delivery.instructions}
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
