import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { getCart } from '@/lib/cart';
import { getPaymentMethods, getSettings } from '@/lib/catalog';
import { formatPEN } from '@/lib/format';
import CheckoutPayment from '@/components/CheckoutPayment';
import { placeOrderAction } from '@/app/actions/checkout';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Confirmar pedido' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser('/checkout');
  const { error } = await searchParams;
  const cart = await getCart();
  const methods = getPaymentMethods(true);
  const settings = getSettings();
  const idempotencyKey = randomUUID();

  if (cart.lines.length === 0) {
    return (
      <div className="shell py-16 text-center">
        <h1 className="text-2xl font-black">Tu carrito está vacío</h1>
        <p className="muted mt-2 text-sm">Agrega productos antes de confirmar un pedido.</p>
        <Link href="/productos" className="btn btn-primary mt-5">Ir al catálogo</Link>
      </div>
    );
  }

  return (
    <div className="shell py-8">
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Confirmar pedido</h1>
      <p className="muted mt-1 text-sm">
        Completa tus datos y elige cómo pagar: con tu saldo NovaStore se cobra al instante y sin
        comprobante; con un método externo, un administrador verificará tu pago antes de entregar el
        producto.
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      ) : null}

      <form action={placeOrderAction} className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <input type="hidden" name="idempotency_key" value={idempotencyKey} />

        <div className="space-y-4">
          <section className="panel p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              1. Datos de contacto
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="contact_email" className="label">Correo electrónico</label>
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  required
                  defaultValue={user.email}
                  className="input"
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
              <div>
                <label htmlFor="contact_phone" className="label">Teléfono / WhatsApp</label>
                <input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  required
                  defaultValue={user.phone ?? ''}
                  className="input"
                  placeholder="9XX XXX XXX"
                />
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="customer_note" className="label">Nota para el vendedor (opcional)</label>
              <textarea
                id="customer_note"
                name="customer_note"
                rows={2}
                maxLength={500}
                className="textarea"
                placeholder="Ej.: mi usuario de la plataforma es..."
              />
            </div>
          </section>

          <CheckoutPayment
            methods={methods}
            balanceCents={user.balance_cents}
            totalCents={cart.subtotal_cents}
          />
        </div>

        <aside className="panel h-fit p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Tu pedido
          </h2>
          <ul className="mt-3 space-y-2">
            {cart.lines.map((line) => (
              <li key={line.item_id} className="flex items-start justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-slate-200">{line.name}</span>
                  <span className="text-xs text-slate-500">
                    {line.variant_name ? `${line.variant_name} · ` : ''}x{line.quantity}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-white">
                  {formatPEN(line.line_total_cents)}
                </span>
              </li>
            ))}
          </ul>
          <div className="divider my-3" />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{formatPEN(cart.subtotal_cents)}</span>
            </div>
            {cart.savings_cents > 0 ? (
              <div className="flex justify-between text-emerald-300">
                <span>Ahorro</span>
                <span>-{formatPEN(cart.savings_cents)}</span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between pt-1">
              <span className="font-bold text-white">Total a pagar</span>
              <span className="text-xl font-black text-white">{formatPEN(cart.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Tu saldo disponible</span>
              <span className="font-semibold text-slate-200">{formatPEN(user.balance_cents)}</span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary mt-5 w-full" disabled={methods.length === 0}>
            Confirmar pedido
          </button>
          <Link href="/carrito" className="btn btn-ghost mt-2 w-full">Volver al carrito</Link>
          <Link href="/cuenta/saldo" className="btn btn-ghost mt-2 w-full">Añadir saldo</Link>

          <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">
            Con pago por saldo el pedido se cobra y registra al instante. Con métodos externos el
            pedido queda <strong className="text-slate-300">pendiente</strong> hasta que el
            administrador verifique el comprobante. Soporte:{' '}
            {settings.contact_email || 'contacto de la tienda'}.
          </p>
        </aside>
      </form>
    </div>
  );
}
