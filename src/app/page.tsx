import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import CategoryCard from '@/components/CategoryCard';
import HeroCarousel, { type HeroSlide } from '@/components/home/HeroCarousel';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';
import {
  computePricing,
  getActiveOffers,
  getProducts,
  getRecentPurchases,
  getRootCategories,
  getSettings,
} from '@/lib/catalog';
import { formatPEN, maskName, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TRUST = [
  {
    title: 'Entrega rápida',
    text: 'Productos digitales enviados tras validar tu pago.',
    icon: 'M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8Z',
  },
  {
    title: 'Compra segura',
    text: 'Cada comprobante lo revisa un administrador.',
    icon: 'M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3Z',
  },
  {
    title: 'Soporte real',
    text: 'Atención directa por chat y Telegram.',
    icon: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z',
  },
  {
    title: 'Precios en soles',
    text: 'Paga en PEN con saldo, Yape o Plin.',
    icon: 'M12 3v18M8 7h8a3 3 0 0 1 0 6H8h8a3 3 0 0 1 0 6H8',
  },
];

export default async function HomePage() {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const settings = getSettings();
  const categories = getRootCategories();
  const offers = getActiveOffers();
  const all = getProducts({ limit: 120 });
  const featured = getProducts({ featuredOnly: true, limit: 8 });
  const newest = getProducts({ sort: 'recent', limit: 6 });
  const popular = getProducts({ sort: 'popular', limit: 4 });
  const discounted = all
    .map((product) => ({ product, pricing: computePricing(product, offers) }))
    .filter((row) => row.pricing.discountPercent > 0)
    .slice(0, 10);
  const recent = getRecentPurchases(6);
  const topCategory = categories[0];

  const slides: HeroSlide[] = [];

  if (discounted[0]) {
    const { product, pricing } = discounted[0];
    slides.push({
      id: `offer-${product.id}`,
      eyebrow: `Oferta · -${pricing.discountPercent}%`,
      title: product.name,
      subtitle: product.description,
      imageUrl: product.image_url,
      meta: `${formatPEN(pricing.priceCents)} · antes ${formatPEN(pricing.comparePriceCents ?? product.price_cents)}`,
      ctaLabel: 'Aprovechar oferta',
      ctaHref: `/producto/${product.slug}`,
      accent: 'blue',
    });
  }

  if (popular[0]) {
    slides.push({
      id: `popular-${popular[0].id}`,
      eyebrow: 'Más vendido',
      title: popular[0].name,
      subtitle: popular[0].description,
      imageUrl: popular[0].image_url,
      meta: `Desde ${formatPEN(popular[0].price_cents)} · entrega digital`,
      ctaLabel: 'Comprar ahora',
      ctaHref: `/producto/${popular[0].slug}`,
      accent: 'cyan',
    });
  }

  if (topCategory) {
    slides.push({
      id: `category-${topCategory.id}`,
      eyebrow: 'Categoría destacada',
      title: topCategory.name,
      subtitle: topCategory.description || 'Explora los productos digitales más pedidos de la tienda.',
      imageUrl: topCategory.image_url,
      meta: `${topCategory.product_count ?? 0} productos disponibles`,
      ctaLabel: 'Ver categoría',
      ctaHref: `/categoria/${topCategory.slug}`,
      accent: 'purple',
    });
  }

  slides.push({
    id: 'community',
    eyebrow: settings.telegram_url ? 'Comunidad NOVASTORE' : 'Compra protegida',
    title: settings.telegram_url ? 'Ofertas y novedades en nuestro canal' : 'Tu compra, siempre protegida',
    subtitle: settings.telegram_url
      ? 'Únete al canal oficial de Telegram y entérate primero de los descuentos y del nuevo stock.'
      : 'Cada pedido queda registrado, con comprobante verificado y soporte durante todo el proceso.',
    meta: 'Atención en español · Perú',
    ctaLabel: settings.telegram_url ? 'Abrir Telegram' : 'Ver catálogo',
    ctaHref: settings.telegram_url || '/productos',
    accent: 'blue',
  });

  return (
    <div className="pb-6">
      {/* HERO + CARRUSEL */}
      <section className="shell pt-5">
        <div className="grid gap-5 lg:grid-cols-[1.02fr_1.18fr] lg:items-stretch">
          <div className="relative flex flex-col justify-center">
            <div className="blue-glow -left-10 top-0 h-40 w-40 bg-sky-500/30" />
            <div className="relative">
              <span className="badge border border-sky-400/40 bg-sky-500/15 text-sky-100">
                Tienda digital en Perú
              </span>
              <h1 className="mt-3 text-[2.05rem] font-black leading-[1.06] tracking-tight text-white sm:text-[2.9rem]">
                Todo lo digital,
                <br />
                <span className="nova-blue-text">al instante.</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-[0.95rem]">
                {settings.store_tagline ||
                  'Recargas, streaming, aplicaciones y números virtuales con entrega digital y soporte real.'}
              </p>

              <form action="/productos" method="get" className="mt-5 max-w-md">
                <div className="flex items-center gap-2 rounded-2xl border border-sky-400/25 bg-black/50 p-1.5 pl-3.5 shadow-[0_18px_40px_-30px_rgba(47,107,255,0.9)] focus-within:border-sky-400/70">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    type="search"
                    name="q"
                    placeholder="Buscar diamantes, streaming, apps…"
                    aria-label="Buscar productos en NOVASTORE"
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <button type="submit" className="btn btn-primary btn-sm shrink-0">
                    Buscar
                  </button>
                </div>
              </form>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {categories.slice(0, 4).map((category) => (
                  <Link key={category.id} href={`/categoria/${category.slug}`} className="chip">
                    {category.name}
                  </Link>
                ))}
                <Link href="/productos" className="chip chip-active">
                  Ver todo
                </Link>
              </div>

              <dl className="mt-5 grid max-w-md grid-cols-3 gap-2">
                {[
                  { label: 'Productos', value: String(all.length) },
                  { label: 'Categorías', value: String(categories.length) },
                  { label: 'Entrega', value: 'Digital' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <dt className="text-[0.6rem] uppercase tracking-[0.12em] text-slate-400">{stat.label}</dt>
                    <dd className="text-sm font-black text-white">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="min-w-0">
            <HeroCarousel slides={slides} />
          </div>
        </div>
      </section>

      {/* SELLOS DE CONFIANZA */}
      <section className="shell mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST.map((item, index) => (
          <div
            key={item.title}
            className="panel-flat flex items-start gap-3 p-3.5 animate-fade-up"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-sky-400/25 bg-sky-500/10 text-sky-200">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={item.icon} />
              </svg>
            </span>
            <div>
              <h3 className="text-[0.82rem] font-bold text-white">{item.title}</h3>
              <p className="mt-0.5 text-[0.72rem] leading-snug text-slate-400">{item.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* CATEGORÍAS */}
      <section className="shell mt-9">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Explora por categoría</h2>
            <p className="muted mt-1 text-sm">Cada categoría tiene su propia experiencia de compra.</p>
          </div>
          <Link href="/productos" className="link whitespace-nowrap text-sm font-semibold">
            Ver todo →
          </Link>
        </div>
        {categories.length === 0 ? (
          <p className="panel-flat p-6 text-sm text-slate-400">
            Todavía no hay categorías publicadas. El administrador puede crearlas desde el panel.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category, index) => (
              <CategoryCard key={category.id} category={category} index={index} />
            ))}
          </div>
        )}
      </section>

      {/* OFERTAS */}
      {discounted.length > 0 ? (
        <section className="shell mt-9">
          <div className="panel relative overflow-hidden p-5 sm:p-6">
            <div className="blue-glow -right-10 -top-12 h-56 w-56 bg-sky-600/30" />
            <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="badge badge-danger mb-2">Ofertas activas</span>
                <h2 className="section-title">Descuentos por tiempo limitado</h2>
                <p className="muted mt-1 text-sm">El descuento se aplica solo en el carrito.</p>
              </div>
              <Link href="/productos?ofertas=1" className="btn btn-outline btn-sm">
                Ver todas
              </Link>
            </div>
            <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {discounted.map((row, index) => (
                <div key={row.product.id} className="w-[9.5rem] shrink-0 sm:w-[11rem]">
                  <ProductCard product={row.product} offers={offers} index={index} variant="compact" />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* DESTACADOS */}
      <section className="shell mt-9">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Productos destacados</h2>
            <p className="muted mt-1 text-sm">Los favoritos de nuestros clientes.</p>
          </div>
          <Link href="/productos" className="link whitespace-nowrap text-sm font-semibold">
            Ver catálogo →
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className="panel-flat p-6 text-sm text-slate-400">
            Aún no hay productos destacados. El administrador puede marcarlos desde el panel.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {featured.map((product, index) => (
              <ProductCard key={product.id} product={product} offers={offers} index={index} />
            ))}
          </div>
        )}
      </section>

      {/* COMPRAS RECIENTES + NOVEDADES */}
      <section className="shell mt-9 grid gap-4 lg:grid-cols-[1fr_1.25fr] lg:items-start">
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-white">Compras recientes</h2>
              <p className="muted mt-0.5 text-xs">Pedidos confirmados en la tienda.</p>
            </div>
            <span className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              En vivo
            </span>
          </div>
          <ul className="space-y-2">
            {recent.length === 0 ? (
              <li className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-400">
                Sé el primero en comprar en NOVASTORE. ¡Los pedidos aparecerán aquí!
              </li>
            ) : (
              recent.map((purchase, index) => (
                <li
                  key={`${purchase.order_number}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-2.5 animate-fade-up"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-xs font-black text-white">
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

        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="section-title">Recién agregados</h2>
              <p className="muted mt-1 text-sm">Nuevo stock digital disponible hoy.</p>
            </div>
            <Link href="/productos" className="link whitespace-nowrap text-sm font-semibold">
              Ver más →
            </Link>
          </div>
          <div className="space-y-2">
            {newest.length === 0 ? (
              <p className="panel-flat p-5 text-sm text-slate-400">Aún no hay productos publicados.</p>
            ) : (
              newest.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  offers={offers}
                  index={index}
                  variant="row"
                />
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA CONTACTO */}
      <section className="shell mt-10">
        <div className="hero-banner px-6 py-8 text-center sm:px-10 sm:py-12">
          <div className="blue-glow left-1/2 top-0 h-56 w-56 -translate-x-1/2 bg-blue-600/40" />
          <div className="relative">
            <h2 className="text-xl font-black text-white sm:text-3xl">¿Necesitas ayuda con tu compra?</h2>
            <p className="muted mx-auto mt-2 max-w-xl text-sm">
              Escríbenos y te ayudamos a elegir el producto ideal. También puedes revisar el estado de
              tus pedidos desde tu cuenta.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <Link href="/contacto" className="btn btn-primary">
                Contactar ahora
              </Link>
              <Link href="/cuenta/soporte" className="btn btn-ghost">
                Chat de soporte
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
          </div>
        </div>
      </section>
    </div>
  );
}
