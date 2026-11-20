import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProductCard from '@/components/ProductCard';
import { getDurationLabels } from '@/lib/product-duration';
import CategoryCard from '@/components/CategoryCard';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';
import {
  computePricing,
  getActiveOffers,
  getCategoryAncestors,
  getCategoryBySlug,
  getCategoryDescendantIds,
  getProducts,
  getSettings,
  getSubcategories,
  type Offer,
  type Product,
} from '@/lib/catalog';
import { detectCategoryKind, KIND_META, splitBenefits } from '@/lib/category-kind';
import { formatPEN } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: 'Categoría no encontrada · NOVASTORE' };
  return {
    title: `${category.name} · NOVASTORE`,
    description: category.description || `Compra ${category.name} en NOVASTORE.`,
  };
}

function CheckIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function StockLine({ product }: { product: Product }) {
  if (product.stock === null) {
    return <span className="text-[0.64rem] text-emerald-300">Disponible</span>;
  }
  if (product.stock <= 0) {
    return <span className="text-[0.64rem] text-rose-300">Agotado</span>;
  }
  return <span className="text-[0.64rem] text-slate-400">{product.stock} disponibles</span>;
}

/** Recargas: paquetes compactos, sin imágenes gigantes. */
function RechargeGrid({ products, offers }: { products: Product[]; offers: Offer[] }) {
  return (
    <div className="pkg-grid">
      {products.map((product, index) => {
        const pricing = computePricing(product, offers);
        const soldOut = product.stock !== null && product.stock <= 0;
        return (
          <Link
            key={product.id}
            href={`/producto/${product.slug}`}
            className={`pkg animate-fade-up ${soldOut ? 'opacity-70' : ''}`}
            style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
          >
            {pricing.discountPercent > 0 ? (
              <span className="badge badge-danger pkg-off">-{pricing.discountPercent}%</span>
            ) : null}
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt=""
                loading="lazy"
                className="mb-1 h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <span className="mb-1 grid h-8 w-8 place-items-center rounded-lg bg-sky-500/15 text-sky-200">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 2l2.6 6.3L21 9.4l-4.8 4.2 1.5 6.4L12 16.6 6.3 20l1.5-6.4L3 9.4l6.4-1.1L12 2z" />
                </svg>
              </span>
            )}
            <span className="line-clamp-2 text-[0.78rem] font-bold leading-tight text-white">
              {product.name}
            </span>
            <span className="text-sm font-black text-sky-200">{formatPEN(pricing.priceCents)}</span>
            <StockLine product={product} />
          </Link>
        );
      })}
    </div>
  );
}

/** Pases y membresías: tarjetas con beneficios. */
function PassesGrid({ products, offers }: { products: Product[]; offers: Offer[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {products.map((product, index) => {
        const pricing = computePricing(product, offers);
        const benefits = splitBenefits(product.description);
        return (
          <Link
            key={product.id}
            href={`/producto/${product.slug}`}
            className="card-product animate-fade-up group p-4"
            style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-sky-400/25 bg-gradient-to-br from-blue-900/60 to-black">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-lg">🎟️</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white">
                    {product.name}
                  </h3>
                  {pricing.discountPercent > 0 ? (
                    <span className="badge badge-danger shrink-0">-{pricing.discountPercent}%</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-lg font-black text-white">{formatPEN(pricing.priceCents)}</p>
              </div>
            </div>

            {benefits.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-1.5 text-[0.72rem] text-slate-300">
                    <CheckIcon className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" />
                    <span className="line-clamp-1">{benefit}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 line-clamp-2 text-[0.72rem] text-slate-400">{product.description}</p>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <StockLine product={product} />
              <span className="btn btn-primary btn-sm" aria-hidden="true">
                Comprar
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** Números virtuales: filas con país/servicio y precio. */
function NumbersList({ products, offers }: { products: Product[]; offers: Offer[] }) {
  return (
    <div className="space-y-2">
      {products.map((product, index) => {
        const pricing = computePricing(product, offers);
        const tags = splitBenefits(product.description, 2);
        return (
          <Link
            key={product.id}
            href={`/producto/${product.slug}`}
            className="row-card animate-fade-up"
            style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sky-400/25 bg-sky-500/10 text-lg">
              🌐
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{product.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <span key={tag} className="chip !px-2 !py-0.5 !text-[0.6rem]">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-[0.66rem] text-slate-400">Número virtual</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-black text-white">{formatPEN(pricing.priceCents)}</p>
              <StockLine product={product} />
            </div>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        );
      })}
    </div>
  );
}

/** Apps y software: tarjetas con icono y características. */
function AppsGrid({ products, offers }: { products: Product[]; offers: Offer[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {products.map((product, index) => {
        const pricing = computePricing(product, offers);
        const features = splitBenefits(product.description, 3);
        return (
          <Link
            key={product.id}
            href={`/producto/${product.slug}`}
            className="card-product animate-fade-up p-4"
            style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-sky-400/25 bg-gradient-to-br from-blue-900/60 to-black">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-lg">💻</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-bold text-white">{product.name}</h3>
                <p className="text-base font-black text-sky-200">{formatPEN(pricing.priceCents)}</p>
              </div>
              {pricing.discountPercent > 0 ? (
                <span className="badge badge-danger">-{pricing.discountPercent}%</span>
              ) : null}
            </div>
            {features.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {features.map((feature) => (
                  <li key={feature} className="chip !px-2 !py-0.5 !text-[0.62rem]">
                    {feature}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex items-center justify-between">
              <StockLine product={product} />
              <span className="btn btn-primary btn-sm" aria-hidden="true">
                Ver licencia
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category || category.is_active === 0) notFound();

  const settings = getSettings();
  const offers = getActiveOffers();
  const ancestors = getCategoryAncestors(category);
  const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
  const children = getSubcategories(category.id);
  const ids = new Set<number>([category.id, ...getCategoryDescendantIds(category.id)]);
  const products = getProducts({ limit: 500 }).filter(
    (product) => product.category_id !== null && ids.has(product.category_id),
  );
  const durationLabels = getDurationLabels(products.map((product) => product.id));
  const kind = detectCategoryKind(category, products);
  const meta = KIND_META[kind];
  const minPrice = products.length > 0 ? Math.min(...products.map((p) => p.price_cents)) : null;

  return (
    <div className="shell pb-16 pt-4">
      {/* MIGAS DE PAN */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[0.72rem] text-slate-400">
        <Link href="/" className="hover:text-sky-200">
          Tienda
        </Link>
        {ancestors.map((item) => (
          <span key={item.id} className="flex items-center gap-1.5">
            <span className="text-slate-600">/</span>
            <Link href={`/categoria/${item.slug}`} className="hover:text-sky-200">
              {item.name}
            </Link>
          </span>
        ))}
        <span className="text-slate-600">/</span>
        <span className="font-semibold text-sky-200">{category.name}</span>
      </nav>

      {/* ENCABEZADO DE LA CATEGORÍA */}
      <section className="hero-banner mt-3 px-5 py-7 sm:px-8 sm:py-9">
        {category.image_url ? (
          <div className="slide-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={category.image_url} alt="" />
          </div>
        ) : null}
        <div className="slide-veil" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge border border-sky-400/40 bg-sky-500/15 text-sky-100">
                {meta.label}
              </span>
              <span className="chip">{products.length} productos</span>
              {minPrice !== null ? (
                <span className="chip">Desde {formatPEN(minPrice)}</span>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              {category.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
              {category.description || meta.blurb}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {parent ? (
              <Link href={`/categoria/${parent.slug}`} className="btn btn-ghost btn-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
                {parent.name}
              </Link>
            ) : (
              <Link href="/productos" className="btn btn-ghost btn-sm">
                Ver todo el catálogo
              </Link>
            )}
            {settings.whatsapp_url ? (
              <a
                href={settings.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                Soporte
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* SUBCATEGORÍAS (segundo nivel) */}
      {children.length > 0 ? (
        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="section-title">Elige una opción</h2>
              <p className="muted mt-0.5 text-xs">
                Entra en una subcategoría para ver sus productos.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {children.map((child, index) => (
              <CategoryCard key={child.id} category={child} index={index} />
            ))}
          </div>
        </section>
      ) : null}

      {/* CONTENIDO PRINCIPAL + PANEL LATERAL */}
      <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="section-title">
                {children.length > 0 ? 'También en esta categoría' : 'Productos disponibles'}
              </h2>
              <p className="muted mt-0.5 text-xs">
                {products.length > 0
                  ? 'Precios en soles con entrega digital y soporte incluido.'
                  : 'Todavía no hay productos publicados aquí.'}
              </p>
            </div>
            <span className="chip chip-active">{meta.chip}</span>
          </div>

          {products.length === 0 ? (
            <div className="panel-flat p-6 text-center">
              <p className="text-sm font-semibold text-white">Aún no hay productos en esta categoría</p>
              <p className="muted mx-auto mt-1 max-w-md text-xs">
                El administrador puede agregar productos desde el panel y aparecerán aquí
                automáticamente.
              </p>
              <Link href="/productos" className="btn btn-primary btn-sm mt-4">
                Explorar catálogo
              </Link>
            </div>
          ) : kind === 'recharge' ? (
            <RechargeGrid products={products} offers={offers} />
          ) : kind === 'passes' ? (
            <PassesGrid products={products} offers={offers} />
          ) : kind === 'numbers' ? (
            <NumbersList products={products} offers={offers} />
          ) : kind === 'apps' ? (
            <AppsGrid products={products} offers={offers} />
          ) : kind === 'streaming' ? (
            <div className="grid gap-2 xl:grid-cols-2">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  offers={offers}
                  index={index}
                  variant="row"
                  duration={durationLabels.get(product.id) ?? null}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  offers={offers}
                  index={index}
                  duration={durationLabels.get(product.id) ?? null}
                />
              ))}
            </div>
          )}
        </div>

        {/* PANEL LATERAL (escritorio) */}
        <aside className="space-y-3 lg:sticky lg:top-24">
          <div className="side-panel p-5">
            <h3 className="text-sm font-extrabold text-white">Cómo comprar en {category.name}</h3>
            <ol className="mt-3 space-y-2.5">
              {meta.steps.map((step, index) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-500/20 text-[0.62rem] font-black text-sky-200">
                    {index + 1}
                  </span>
                  <span className="text-[0.76rem] leading-snug text-slate-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="side-panel p-5">
            <h3 className="text-sm font-extrabold text-white">Compra protegida</h3>
            <ul className="mt-3 space-y-2">
              {[
                'Pago con saldo NovaStore, Yape o Plin.',
                'Comprobante revisado por un administrador.',
                'Soporte directo por el chat de la tienda.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[0.74rem] text-slate-300">
                  <CheckIcon className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/cuenta/saldo" className="btn btn-outline btn-sm mt-4 w-full">
              Añadir saldo
            </Link>
          </div>

          {settings.whatsapp_url ? (
            <div className="side-panel relative overflow-hidden p-5">
              <div className="blue-glow -right-8 -top-8 h-28 w-28 bg-emerald-500/40" />
              <div className="relative">
                <h3 className="text-sm font-extrabold text-white">¿Dudas antes de comprar?</h3>
                <p className="muted mt-1 text-[0.74rem]">
                  Escríbenos por WhatsApp y te ayudamos a elegir.
                </p>
                <a
                  href={settings.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm mt-3 w-full"
                >
                  Abrir WhatsApp
                </a>
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
