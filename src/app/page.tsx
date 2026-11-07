import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import CategoryCard from '@/components/CategoryCard';
import { getActiveOffers, getCategories, getProducts, getRecentPurchases, getSettings, computePricing } from '@/lib/catalog';
import { formatPEN, maskName, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const settings = getSettings();
  const categories = getCategories();
  const offers = getActiveOffers();
  const featured = getProducts({ featuredOnly: true, limit: 8 });
  const all = getProducts({ limit: 60 });
  const discounted = all
    .map((p) => ({ product: p, pricing: computePricing(p, offers) }))
    .filter((row) => row.pricing.discountPercent > 0)
    .slice(0, 8);
  const recent = getRecentPurchases(6);
  const newest = getProducts({ sort: 'recent', limit: 8 });

  return (
    <div className="pb-6">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-purple-500/15">
        <div className="grid-lines absolute inset-0 opacity-70" />
        <div className="hero-glow left-[-6rem] top-[-4rem] h-72 w-72 bg-purple-600/40 animate-glow" />
        <div className="hero-glow right-[-4rem] top-10 h-64 w-64 bg-fuchsia-500/25 animate-floaty" />

        <div className="shell relative grid items-center gap-10 py-12 md:grid-cols-[1.15fr_0.85fr] md:py-20">
          <div className="animate-fade-up">
            <span className="badge badge-purple mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" /> Entrega inmediata 24/7
            </span>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="gradient-text">Productos digitales</span>
              <br />
              al mejor precio en Perú
            </h1>
            <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-slate-300">
              {settings.store_tagline || 'Gift cards, suscripciones, apps y números virtuales'}.
              Paga en soles con <strong className="text-white">Yape</strong>,{' '}
              <strong className="text-white">Plin</strong> o tarjeta. Verificamos tu comprobante y
              entregamos al instante.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/productos" className="btn btn-primary">
                Ver catálogo
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              {settings.telegram_url ? (
                <a
                  href={settings.telegram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                >
                  Unirme al Telegram
                </a>
              ) : (
                <Link href="/contacto" className="btn btn-outline">
                  Contactar
                </Link>
              )}
            </div>

            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-3">
              {[
                { label: 'Productos', value: `${all.length}+` },
                { label: 'Categorías', value: `${categories.length}` },
                { label: 'Atención', value: '24/7' },
              ].map((item) => (
                <div key={item.label} className="panel-flat px-3 py-2.5 text-center">
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-purple-300/80">
                    {item.label}
                  </dt>
                  <dd className="text-lg font-black text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative animate-fade-up delay-2">
            <div className="panel relative overflow-hidden p-5">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
                  Compras recientes
                </h2>
                <span className="flex items-center gap-1.5 text-[0.68rem] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> En vivo
                </span>
              </div>
              <ul className="mt-4 space-y-2.5">
                {recent.length === 0 ? (
                  <li className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-400">
                    Sé el primero en comprar en NOVASTORE. ¡Los pedidos aparecerán aquí!
                  </li>
                ) : (
                  recent.map((purchase, i) => (
                    <li
                      key={`${purchase.order_number}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-2.5 animate-fade-up"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xs font-black text-white">
                        {purchase.buyer.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.82rem] font-semibold text-white">
                          {maskName(purchase.buyer)}
                        </p>
                        <p className="truncate text-[0.72rem] text-slate-400">
                          {purchase.product_name} ×{purchase.quantity}
                        </p>
                      </div>
                      <span className="shrink-0 text-[0.66rem] text-slate-500">
                        {timeAgo(purchase.created_at)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="shell -mt-2 grid gap-3 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Pago seguro', text: 'Comprobante verificado por un administrador.', icon: 'M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3Z' },
          { title: 'Entrega rápida', text: 'Recibe tu producto digital tras la validación.', icon: 'M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8Z' },
          { title: 'Precios en soles', text: 'Precios claros en PEN, sin sorpresas.', icon: 'M12 3v18M8 7h8a3 3 0 0 1 0 6H8h8a3 3 0 0 1 0 6H8' },
          { title: 'Soporte real', text: 'Atención por Telegram y contacto directo.', icon: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z' },
        ].map((benefit, i) => (
          <div
            key={benefit.title}
            className="panel-flat flex items-start gap-3 p-4 animate-fade-up"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-500/15 text-purple-300">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d={benefit.icon} />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">{benefit.title}</h3>
              <p className="mt-0.5 text-[0.75rem] leading-snug text-slate-400">{benefit.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* CATEGORÍAS */}
      <section className="shell py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Explora por categoría</h2>
            <p className="muted mt-1 text-sm">Encuentra rápido lo que necesitas.</p>
          </div>
          <Link href="/productos" className="link text-sm font-semibold whitespace-nowrap">
            Ver todo →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category, i) => (
            <CategoryCard key={category.id} category={category} index={i} />
          ))}
        </div>
      </section>

      {/* OFERTAS */}
      {discounted.length > 0 && (
        <section className="shell py-8">
          <div className="panel relative overflow-hidden p-5 sm:p-7">
            <div className="hero-glow right-[-3rem] top-[-3rem] h-56 w-56 bg-fuchsia-600/30" />
            <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="badge badge-danger mb-2">Ofertas activas</span>
                <h2 className="section-title">Descuentos por tiempo limitado</h2>
                <p className="muted mt-1 text-sm">
                  Precios rebajados aplicados automáticamente en el carrito.
                </p>
              </div>
              <Link href="/productos?ofertas=1" className="btn btn-outline btn-sm">
                Ver todas las ofertas
              </Link>
            </div>
            <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {discounted.map((row, i) => (
                <ProductCard key={row.product.id} product={row.product} offers={offers} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DESTACADOS */}
      <section className="shell py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Productos destacados</h2>
            <p className="muted mt-1 text-sm">Los favoritos de nuestros clientes.</p>
          </div>
          <Link href="/productos" className="link text-sm font-semibold whitespace-nowrap">
            Ver catálogo →
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className="panel-flat p-6 text-sm text-slate-400">
            Aún no hay productos destacados. El administrador puede marcarlos desde el panel.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product, i) => (
              <ProductCard key={product.id} product={product} offers={offers} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* NOVEDADES */}
      <section className="shell py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Recién agregados</h2>
            <p className="muted mt-1 text-sm">Nuevo stock digital disponible hoy.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newest.map((product, i) => (
            <ProductCard key={product.id} product={product} offers={offers} index={i} />
          ))}
        </div>
      </section>

      {/* CTA CONTACTO */}
      <section className="shell py-10">
        <div className="panel relative overflow-hidden p-7 text-center sm:p-12">
          <div className="hero-glow left-1/2 top-0 h-64 w-64 -translate-x-1/2 bg-purple-600/35" />
          <div className="relative">
            <h2 className="section-title">¿Necesitas ayuda con tu compra?</h2>
            <p className="muted mx-auto mt-2 max-w-xl text-sm">
              Escríbenos y te ayudamos a elegir el producto ideal. También puedes revisar el estado
              de tus pedidos desde tu cuenta.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/contacto" className="btn btn-primary">
                Contactar ahora
              </Link>
              {settings.telegram_url ? (
                <a
                  href={settings.telegram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                >
                  Canal de Telegram
                </a>
              ) : null}
            </div>
            <p className="mt-5 text-xs text-slate-500">
              Precio mínimo del catálogo: {formatPEN(Math.min(...all.map((p) => p.price_cents), 0) || 0)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
