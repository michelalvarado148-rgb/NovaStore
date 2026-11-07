import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getBalanceMovements, getCustomerOrderCount, getUserOrders } from '@/lib/orders';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
  formatPEN,
  statusTone,
} from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi cuenta' };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const user = await requireUser('/cuenta');
  const { bienvenida } = await searchParams;
  const orders = getUserOrders(user.id);
  const movements = getBalanceMovements(user.id, 4);
  const totalOrders = getCustomerOrderCount(user.id);
  const spent = orders
    .filter((order) => order.status !== 'rechazado' && order.status !== 'cancelado')
    .reduce((sum, order) => sum + order.total_cents, 0);
  const pending = orders.filter(
    (order) => order.status === 'pendiente' || order.status === 'en_proceso',
  ).length;

  return (
    <div className="space-y-5">
      {bienvenida ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          ¡Tu cuenta está lista! Ya puedes comprar, guardar saldo y seguir tus pedidos.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pedidos totales', value: String(totalOrders) },
          { label: 'Pedidos en curso', value: String(pending) },
          { label: 'Total comprado', value: formatPEN(spent) },
          { label: 'Saldo disponible', value: formatPEN(user.balance_cents) },
        ].map((stat) => (
          <div key={stat.label} className="panel p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-purple-300">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-black text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Últimos pedidos
            </h2>
            <Link href="/cuenta/pedidos" className="text-xs font-semibold text-purple-300">
              Ver todos →
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-purple-500/30 p-6 text-center">
              <p className="text-sm text-slate-400">Todavía no tienes pedidos.</p>
              <Link href="/productos" className="btn btn-primary btn-sm mt-3">
                Explorar productos
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {orders.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/pedido/${order.order_number}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-purple-400/50"
                  >
                    <div>
                      <p className="font-mono text-sm font-bold text-white">{order.order_number}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(order.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${statusTone(order.status)}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                      <span className="font-bold text-white">{formatPEN(order.total_cents)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Movimientos de saldo
            </h2>
            <Link href="/cuenta/saldo" className="text-xs font-semibold text-purple-300">
              Ver todo →
            </Link>
          </div>
          {movements.length === 0 ? (
            <p className="text-sm text-slate-400">Sin movimientos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {movements.map((movement) => (
                <li
                  key={movement.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{movement.description}</p>
                    <p className="text-[0.65rem] text-slate-500">
                      {formatDateTime(movement.created_at)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      movement.amount_cents >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {movement.amount_cents >= 0 ? '+' : ''}
                    {formatPEN(movement.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: '/cuenta/perfil', title: 'Mis datos', text: 'Actualiza tu nombre, teléfono y dirección.' },
          { href: '/cuenta/pedidos', title: 'Historial', text: 'Revisa el estado de cada pedido y su comprobante.' },
          { href: '/contacto', title: 'Soporte', text: 'Escríbenos por Telegram o correo.' },
        ].map((card) => (
          <Link key={card.href} href={card.href} className="panel hover-lift p-4">
            <p className="font-bold text-white">{card.title}</p>
            <p className="mt-1 text-xs text-slate-400">{card.text}</p>
          </Link>
        ))}
      </div>

      <p className="text-center text-[0.7rem] text-slate-500">
        Por seguridad, solo tú puedes ver la información de tu cuenta. Estado de pagos:{' '}
        {PAYMENT_STATUS_LABELS.pendiente} hasta la verificación del administrador.
      </p>
    </div>
  );
}
