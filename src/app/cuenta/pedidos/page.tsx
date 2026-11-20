import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getUserOrders } from '@/lib/orders';
import { getDeliveredOrderIds, getPurchaseMeta } from '@/lib/deliveries';
import { ORDER_STATUS_LABELS, formatDateTime, formatPEN, statusTone } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mis compras' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const user = await requireUser('/cuenta/pedidos');
  const { estado } = await searchParams;
  const all = getUserOrders(user.id);
  const orders = estado && estado !== 'todos' ? all.filter((o) => o.status === estado) : all;

  const meta = getPurchaseMeta(orders.map((order) => order.id));
  const withDelivery = getDeliveredOrderIds(orders.map((order) => order.id));

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
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">Mis compras</h1>
          <p className="text-xs text-slate-400">
            Tus pedidos con su estado y los datos que recibiste al ser entregados.
          </p>
        </div>
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
          <p className="text-3xl">🛍️</p>
          <p className="mt-2 text-sm text-slate-400">No hay compras en esta categoría.</p>
          <Link href="/" className="btn btn-primary btn-sm mt-4">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orders.map((order) => {
            const item = meta.get(order.id);
            const hasDelivery = withDelivery.has(order.id) && order.status === 'entregado';
            return (
              <article
                key={order.id}
                className="rounded-2xl border border-purple-500/25 bg-[#0f0a1a] p-3 transition hover:border-purple-400/50"
              >
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-purple-500/25 bg-purple-500/10">
                    {item?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-xl">📦</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{item?.name ?? 'Producto'}</p>
                    <p className="font-mono text-[0.7rem] text-purple-300">#{order.order_number}</p>
                    <p className="text-[0.7rem] text-slate-400">
                      {formatDateTime(order.created_at)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`badge ${statusTone(order.status)}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                      {item && item.lines > 1 ? (
                        <span className="text-[0.65rem] text-slate-400">
                          +{item.lines - 1} producto(s)
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="shrink-0 text-sm font-black text-white">
                    {formatPEN(order.total_cents)}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/pedido/${order.order_number}`}
                    className="btn btn-outline btn-xs flex-1"
                  >
                    Ver detalle
                  </Link>
                  {hasDelivery ? (
                    <Link
                      href={`/pedido/${order.order_number}/entrega`}
                      className="btn btn-primary btn-xs"
                      aria-label={`Ver los datos entregados del pedido ${order.order_number}`}
                      title="Ver los datos que recibiste"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="2.8" />
                      </svg>
                    </Link>
                  ) : (
                    <span
                      className="btn btn-ghost btn-xs cursor-not-allowed opacity-45"
                      title="Disponible cuando el administrador entregue tu producto"
                      aria-label="Datos disponibles al entregar el pedido"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="2.8" />
                      </svg>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
