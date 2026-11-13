import Link from 'next/link';
import { getCart } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';
import { formatPEN } from '@/lib/format';
import { removeCartAction, updateCartAction } from '@/app/actions/cart';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carrito de compras' };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ agregado?: string; error?: string }>;
}) {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const { agregado, error } = await searchParams;
  const [cart, user] = await Promise.all([getCart(), getCurrentUser()]);

  return (
    <div className="shell py-8">
      <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Carrito de compras</h1>
      <p className="muted mt-1 text-sm">
        Revisa tus productos antes de confirmar el pedido. Los precios se validan en el servidor.
      </p>

      {agregado ? (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Producto agregado al carrito correctamente.
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      ) : null}

      {cart.lines.length === 0 ? (
        <div className="panel mt-6 p-10 text-center">
          <p className="text-lg font-bold text-white">Tu carrito está vacío</p>
          <p className="muted mx-auto mt-1 max-w-md text-sm">
            Explora el catálogo y agrega productos digitales para continuar con tu compra.
          </p>
          <Link href="/productos" className="btn btn-primary mt-5">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            {cart.lines.map((line) => {
              const maxQty = line.stock === null ? 20 : Math.min(20, line.stock);
              const unavailable = line.is_active === 0 || (line.stock !== null && line.stock <= 0);
              return (
                <div
                  key={line.item_id}
                  className="panel-flat flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                >
                  <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-violet-900/50 to-black">
                    {line.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.image_url} alt={line.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-lg font-black text-purple-300/40">
                        {line.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/producto/${line.slug}`}
                      className="line-clamp-2 text-sm font-bold text-white hover:text-purple-200"
                    >
                      {line.name}
                    </Link>
                    {line.variant_name ? (
                      <p className="mt-0.5 text-xs text-purple-300">{line.variant_name}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-400">
                      {formatPEN(line.unit_price_cents)} c/u
                      {line.discount_percent > 0 ? (
                        <span className="ml-2 text-fuchsia-300">-{line.discount_percent}%</span>
                      ) : null}
                    </p>
                    {unavailable ? (
                      <p className="mt-1 text-xs font-semibold text-red-300">
                        Sin stock suficiente. Actualiza la cantidad.
                      </p>
                    ) : null}
                  </div>

                  <form action={updateCartAction} className="flex items-center gap-2">
                    <input type="hidden" name="item_id" value={line.item_id} />
                    <input
                      type="number"
                      name="quantity"
                      min={1}
                      max={Math.max(1, maxQty)}
                      defaultValue={line.quantity}
                      className="input w-20 py-1.5 text-center"
                      aria-label={`Cantidad de ${line.name}`}
                    />
                    <button type="submit" className="btn btn-ghost btn-sm" title="Actualizar cantidad">
                      Actualizar
                    </button>
                  </form>

                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <span className="text-sm font-black text-white">{formatPEN(line.line_total_cents)}</span>
                    <form action={removeCartAction}>
                      <input type="hidden" name="item_id" value={line.item_id} />
                      <button type="submit" className="btn btn-danger btn-sm" title="Eliminar producto">
                        Quitar
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
            <Link href="/productos" className="link inline-block text-sm font-semibold">
              ← Seguir comprando
            </Link>
          </div>

          <aside className="panel h-fit p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Resumen del pedido
            </h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-300">
                <dt>Productos ({cart.count})</dt>
                <dd>{formatPEN(cart.subtotal_cents)}</dd>
              </div>
              {cart.savings_cents > 0 ? (
                <div className="flex justify-between text-emerald-300">
                  <dt>Descuentos aplicados</dt>
                  <dd>-{formatPEN(cart.savings_cents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-400">
                <dt>Envío</dt>
                <dd>Digital · S/ 0.00</dd>
              </div>
              <div className="divider my-2" />
              <div className="flex items-baseline justify-between">
                <dt className="font-bold text-white">Total</dt>
                <dd className="text-xl font-black text-white">{formatPEN(cart.subtotal_cents)}</dd>
              </div>
            </dl>

            {user ? (
              <Link href="/checkout" className="btn btn-primary mt-5 w-full">
                Confirmar pedido
              </Link>
            ) : (
              <>
                <Link href="/login?next=/checkout" className="btn btn-primary mt-5 w-full">
                  Iniciar sesión para comprar
                </Link>
                <Link href="/registro?next=/checkout" className="btn btn-outline mt-2 w-full">
                  Crear cuenta nueva
                </Link>
              </>
            )}

            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">
              El pago queda <strong className="text-slate-300">pendiente</strong> hasta que un
              administrador verifique el comprobante. No se aprueban pagos automáticamente.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
