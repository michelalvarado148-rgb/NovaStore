import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import QuantitySelector from '@/components/QuantitySelector';
import { readQtyConfig } from '@/lib/custom-quantity';
import { addToCartAction } from '@/app/actions/cart';
import {
  computePricing,
  getActiveOffers,
  getPaymentMethods,
  getProductBySlug,
  getRelatedProducts,
  getSettings,
  getVariants,
  stockAvailable,
} from '@/lib/catalog';
import { formatPEN, statusTone } from '@/lib/format';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const { slug } = await params;
  const { error } = await searchParams;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const offers = getActiveOffers();
  const pricing = computePricing(product, offers);
  const variants = getVariants(product.id).filter(
    (v) => v.stock === null || v.stock > 0,
  );
  const related = getRelatedProducts(product.category_id, product.id, 4);
  const methods = getPaymentMethods(true);
  const settings = getSettings();
  const available = stockAvailable(product);
  const soldOut = available !== null && available <= 0;

  return (
    <div className="shell py-8">
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-purple-300">Inicio</Link>
        <span>/</span>
        <Link href="/productos" className="hover:text-purple-300">Catálogo</Link>
        {product.category_slug ? (
          <>
            <span>/</span>
            <Link href={`/productos?categoria=${product.category_slug}`} className="hover:text-purple-300">
              {product.category_name}
            </Link>
          </>
        ) : null}
        <span>/</span>
        <span className="text-slate-300">{product.name}</span>
      </nav>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel overflow-hidden p-2 animate-fade-up">
          <div className="relative aspect-[16/11] overflow-hidden rounded-xl bg-gradient-to-br from-violet-900/60 to-black">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-5xl font-black text-purple-300/40">
                {product.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {pricing.discountPercent > 0 && (
              <span className="badge badge-danger absolute left-3 top-3">
                -{pricing.discountPercent}% de descuento
              </span>
            )}
          </div>
        </div>

        <div className="animate-fade-up delay-1">
          {product.category_name ? (
            <Link
              href={`/productos?categoria=${product.category_slug}`}
              className="badge badge-purple mb-3"
            >
              {product.category_name}
            </Link>
          ) : null}
          <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">{product.name}</h1>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <span className="text-3xl font-black text-white">{formatPEN(pricing.priceCents)}</span>
            {pricing.comparePriceCents && pricing.comparePriceCents > pricing.priceCents ? (
              <span className="text-base text-slate-500 line-through">
                {formatPEN(pricing.comparePriceCents)}
              </span>
            ) : null}
            <span className="badge badge-muted">PEN · soles</span>
          </div>
          {pricing.offerTitle ? (
            <p className="mt-1 text-xs font-semibold text-fuchsia-300">Oferta: {pricing.offerTitle}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`badge ${soldOut ? 'badge-danger' : 'badge-success'}`}>
              {soldOut ? 'Agotado' : available === null ? 'Stock ilimitado' : `${available} en stock`}
            </span>
            <span className="badge badge-info">{product.sold_count} vendidos</span>
            <span className={`badge ${statusTone(product.is_active ? 'activo' : 'inactivo')}`}>
              {product.is_active ? 'Disponible' : 'No disponible'}
            </span>
          </div>

          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {product.description}
          </p>

          <form action={addToCartAction} className="panel-flat mt-6 space-y-4 p-4">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="back" value={`/producto/${product.slug}`} />

            {variants.length > 0 ? (
              <div>
                <label htmlFor="variant_id" className="label">Presentación</label>
                <select id="variant_id" name="variant_id" className="select" defaultValue={String(variants[0].id)}>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                      {variant.price_cents ? ` · ${formatPEN(variant.price_cents)}` : ''}
                      {variant.stock !== null ? ` (${variant.stock} disp.)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {readQtyConfig(product.id).enabled ? (
              <QuantitySelector
                priceCents={pricing.priceCents}
                config={readQtyConfig(product.id)}
                available={available}
              />
            ) : (
              <div className="w-28">
                <label htmlFor="quantity" className="label">Cantidad</label>
                <input
                  id="quantity"
                  type="number"
                  name="quantity"
                  min={1}
                  max={available === null ? 20 : Math.min(20, Math.max(1, available))}
                  defaultValue={1}
                  className="input"
                />
              </div>
            )}
            <div className="flex items-end gap-3">
              <button type="submit" className="btn btn-primary flex-1" disabled={soldOut}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
                  <circle cx="10" cy="20" r="1.4" />
                  <circle cx="18" cy="20" r="1.4" />
                </svg>
                {soldOut ? 'Producto agotado' : 'Agregar al carrito'}
              </button>
            </div>
            <p className="text-[0.7rem] leading-relaxed text-slate-500">
              El pago queda pendiente hasta que un administrador verifique tu comprobante. No se
              aprueban pagos automáticamente.
            </p>
          </form>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="panel-flat p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-purple-300">
                Métodos de pago
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {methods.map((m) => m.name).join(' · ') || 'Configurando métodos'}
              </p>
            </div>
            <div className="panel-flat p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-purple-300">
                Soporte
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {settings.contact_phone || 'Escríbenos por el canal de Telegram'}
              </p>
              {settings.telegram_url ? (
                <a
                  href={settings.telegram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link mt-1 inline-block text-xs font-semibold"
                >
                  Ir al canal de Telegram →
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-12">
          <h2 className="section-title mb-4">También te puede interesar</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item, i) => (
              <ProductCard key={item.id} product={item} offers={offers} index={i} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
