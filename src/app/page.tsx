import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { getDurationLabels } from '@/lib/product-duration';
import CategoryRail from '@/components/home/CategoryRail';
import BannerCarousel, { type BannerSlide } from '@/components/home/BannerCarousel';
import WhatsAppBanner from '@/components/home/WhatsAppBanner';
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
export const metadata = { title: 'Inicio' };

export default async function HomePage() {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const settings = getSettings();
  const categories = getRootCategories();
  const offers = getActiveOffers();
  const products = getProducts({ limit: 200 });
  const priced = products.map((product) => ({ product, pricing: computePricing(product, offers) }));
  const durationLabels = getDurationLabels(products.map((product) => product.id));
  const discounted = priced
    .filter((row) => row.pricing.discountPercent > 0)
    .sort((a, b) => b.pricing.discountPercent - a.pricing.discountPercent);
  const featured = getProducts({ featuredOnly: true, limit: 8 });
  const showcase = featured.length > 0 ? featured : products.slice(0, 6);
  const recent = getRecentPurchases(4);
  // Banner de comunidad: solo con el enlace del canal de WhatsApp configurado.
  const whatsappChannel = settings.whatsapp_url || '';

  /* ---------------- Banners: solo con contenido real ---------------- */
  const slides: BannerSlide[] = [];

  const topOffer = discounted[0];
  if (topOffer) {
    slides.push({
      id: `oferta-${topOffer.product.id}`,
      eyebrow: 'Oferta del día',
      title: topOffer.product.name,
      subtitle: topOffer.product.description || 'Precio especial por tiempo limitado.',
      meta: `-${topOffer.pricing.discountPercent}% · ${formatPEN(topOffer.pricing.priceCents)}`,
      ctaLabel: 'Compra aquí',
      ctaHref: `/producto/${topOffer.product.slug}`,
      imageUrl: topOffer.product.image_url,
      mark: 'SALE',
    });
  }

  const heroCategory = categories.find((category) => Boolean(category.image_url)) ?? categories[0];
  if (heroCategory) {
    slides.push({
      id: `categoria-${heroCategory.id}`,
      eyebrow: 'Categoría destacada',
      title: heroCategory.name,
      subtitle: `Explora ${heroCategory.name} y recibe tu compra al instante.`,
      ctaLabel: 'Ver productos',
      ctaHref: `/categoria/${heroCategory.slug}`,
      imageUrl: heroCategory.image_url,
      mark: heroCategory.name.slice(0, 2).toUpperCase(),
    });
  }

  const newest = products[0];
  if (newest) {
    slides.push({
      id: `nuevo-${newest.id}`,
      eyebrow: 'Recién llegado',
      title: newest.name,
      subtitle: newest.description || 'Nuevo producto disponible en NovaStore.',
      meta: formatPEN(computePricing(newest, offers).priceCents),
      ctaLabel: 'Ver producto',
      ctaHref: `/producto/${newest.slug}`,
      imageUrl: newest.image_url,
      mark: 'NEW',
    });
  }

  if (slides.length === 0) {
    slides.push({
      id: 'bienvenida',
      eyebrow: 'NovaStore',
      title: 'Todo lo digital, al instante',
      subtitle: 'Juegos, streaming, apps y números virtuales con entrega inmediata.',
      ctaLabel: 'Ver catálogo',
      ctaHref: '/productos',
      mark: 'NS',
    });
  }

  return (
    <div className="ns-home">
      <h1 className="ns-sr">NovaStore · productos digitales con entrega inmediata</h1>

      <div className="ns-shell pt-3">
        <BannerCarousel slides={slides} />
      </div>

      <WhatsAppBanner href={whatsappChannel} />

      <section className="ns-shell mt-6">
        <div className="ns-sec-head">
          <svg viewBox="0 0 24 24" className="ns-sec-ico h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="7" height="7" rx="1.6" />
            <rect x="13" y="4" width="7" height="7" rx="1.6" />
            <rect x="4" y="13" width="7" height="7" rx="1.6" />
            <rect x="13" y="13" width="7" height="7" rx="1.6" />
          </svg>
          <h2 className="ns-sec-title">Categorías</h2>
          <Link href="/categorias" className="ns-sec-link">
            Ver todas
          </Link>
        </div>
        <CategoryRail categories={categories} />
      </section>

      <section className="ns-shell mt-6">
        <div className="ns-sec-head">
          <svg viewBox="0 0 24 24" className="ns-sec-ico h-4 w-4" fill="currentColor">
            <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
          </svg>
          <h2 className="ns-sec-title">Productos destacados</h2>
          <Link href="/productos" className="ns-sec-link">
            Ver todos
          </Link>
        </div>

        {showcase.length === 0 ? (
          <p className="ns-empty">Todavía no hay productos publicados. Vuelve pronto.</p>
        ) : (
          <div className="ns-grid">
            {showcase.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                offers={offers}
                variant="shop"
                index={index}
                duration={durationLabels.get(product.id) ?? null}
              />
            ))}
          </div>
        )}
      </section>

      {discounted.length > 0 ? (
        <section className="ns-shell mt-6">
          <div className="ns-sec-head">
            <svg viewBox="0 0 24 24" className="ns-sec-ico h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12 12 20 4 12V4h8z" />
              <circle cx="8.5" cy="8.5" r="1.3" />
            </svg>
            <h2 className="ns-sec-title">Ofertas y descuentos</h2>
            <Link href="/productos?ofertas=1" className="ns-sec-link">
              Ver ofertas
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {discounted.slice(0, 8).map((row, index) => (
              <div key={row.product.id} className="w-[9.6rem] shrink-0">
                <ProductCard
                  product={row.product}
                  offers={offers}
                  variant="shop"
                  index={index}
                  duration={durationLabels.get(row.product.id) ?? null}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ns-shell mt-6">
        <div className="ns-benefits">
          <div className="ns-benefit">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
            </svg>
            <span>Entrega rápida</span>
          </div>
          <div className="ns-benefit">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 5 6v6c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>Compra segura</span>
          </div>
          <div className="ns-benefit">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
              <rect x="2.5" y="13" width="4" height="6" rx="1.6" />
              <rect x="17.5" y="13" width="4" height="6" rx="1.6" />
              <path d="M19.5 19v.5a2.5 2.5 0 0 1-2.5 2.5h-2" />
            </svg>
            <span>Soporte 24/7</span>
          </div>
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="ns-shell mt-6">
          <div className="ns-panel">
            <div className="flex items-center justify-between gap-2">
              <h2 className="ns-panel-title">Compras recientes</h2>
              <span className="ns-panel-sub">En tiempo real</span>
            </div>
            <div className="ns-list">
              {recent.map((purchase) => (
                <div className="ns-list-item" key={`${purchase.order_number}-${purchase.product_name}`}>
                  <span className="ns-avatar">{maskName(purchase.buyer).slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.76rem] font-semibold text-white">{purchase.product_name}</p>
                    <p className="text-[0.66rem] text-[#8a9bb0]">
                      {maskName(purchase.buyer)} · Pedido #{purchase.order_number}
                    </p>
                  </div>
                  <span className="text-[0.62rem] text-[#5f7d99]">{timeAgo(purchase.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="ns-shell mt-6">
        <div className="ns-cta">
          <h2>¿Necesitas ayuda con tu compra?</h2>
          <p>Escríbenos y te respondemos lo antes posible. También puedes revisar tus pedidos en cualquier momento.</p>
          <div className="ns-cta-actions">
            <Link href="/contacto" className="ns-btn ns-btn-primary">
              Contactar ahora
            </Link>
            <Link href="/cuenta/soporte" className="ns-btn ns-btn-ghost">
              Chat de soporte
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
