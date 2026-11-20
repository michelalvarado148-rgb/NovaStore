import Link from 'next/link';
import { computePricing, type Offer, type Product } from '@/lib/catalog';
import { formatPEN } from '@/lib/format';
import ProductDurationBadge from '@/components/ProductDurationBadge';

function StockBadge({ stock }: { stock: number | null }) {
  if (stock === null) {
    return <span className="badge badge-success">Disponible</span>;
  }
  if (stock <= 0) {
    return <span className="badge badge-danger">Agotado</span>;
  }
  if (stock <= 5) {
    return <span className="badge badge-warning">Últimas {stock}</span>;
  }
  return <span className="badge badge-success">{stock} disponibles</span>;
}

export type ProductCardVariant = 'grid' | 'compact' | 'row' | 'shop';

function Price({
  priceCents,
  comparePriceCents,
  size = 'md',
}: {
  priceCents: number;
  comparePriceCents: number | null;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className={`font-black text-white ${size === 'sm' ? 'text-sm' : 'text-lg'}`}>
        {formatPEN(priceCents)}
      </span>
      {comparePriceCents && comparePriceCents > priceCents ? (
        <span className="text-[0.7rem] text-slate-500 line-through">
          {formatPEN(comparePriceCents)}
        </span>
      ) : null}
    </div>
  );
}

export default function ProductCard({
  product,
  offers,
  index = 0,
  variant = 'grid',
  duration = null,
}: {
  product: Product;
  offers: Offer[];
  index?: number;
  variant?: ProductCardVariant;
  /** Duración del servicio (solo productos de Streaming que la tengan configurada). */
  duration?: string | null;
}) {
  const pricing = computePricing(product, offers);
  const soldOut = product.stock !== null && product.stock <= 0;
  const href = `/producto/${product.slug}`;
  const delay = { animationDelay: `${Math.min(index, 8) * 60}ms` };

  if (variant === 'row') {
    return (
      <Link
        href={href}
        className={`row-card animate-fade-up ${soldOut ? 'opacity-75' : ''}`}
        style={delay}
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-blue-900/60 via-purple-900/40 to-black">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-sm font-black text-purple-300/70">
              {product.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{product.name}</p>
          <p className="line-clamp-1 text-[0.72rem] text-slate-400">{product.description}</p>
          {duration ? (
            <div className="mt-1">
              <ProductDurationBadge label={duration} />
            </div>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {pricing.discountPercent > 0 ? (
              <span className="badge badge-danger">-{pricing.discountPercent}%</span>
            ) : null}
            {soldOut ? (
              <span className="badge badge-muted">Agotado</span>
            ) : (
              <span className="text-[0.66rem] text-emerald-300">Entrega digital</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Price
            priceCents={pricing.priceCents}
            comparePriceCents={pricing.comparePriceCents}
            size="sm"
          />
          <span className={`btn btn-sm mt-1 ${soldOut ? 'btn-ghost' : 'btn-primary'}`} aria-hidden="true">
            {soldOut ? 'Ver' : 'Comprar'}
          </span>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className={`card-product animate-fade-up group min-w-[9.5rem] ${soldOut ? 'opacity-80' : ''}`}
        style={delay}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-blue-900/50 via-purple-900/30 to-black">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.07]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-2xl font-black text-purple-300/50">
              {product.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0912] via-transparent to-transparent" />
          {pricing.discountPercent > 0 ? (
            <span className="badge badge-danger absolute left-2 top-2 shadow-lg">
              -{pricing.discountPercent}%
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white">{product.name}</h3>
          {duration ? (
            <div className="pt-1">
              <ProductDurationBadge label={duration} />
            </div>
          ) : null}
          <div className="mt-auto pt-1.5">
            <Price priceCents={pricing.priceCents} comparePriceCents={pricing.comparePriceCents} size="sm" />
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'shop') {
    const tag = product.is_featured
      ? { label: 'Popular', icon: 'fire' as const }
      : pricing.discountPercent > 0
        ? { label: 'Recomendado', icon: 'star' as const }
        : null;

    return (
      <article className={`ns-prod animate-fade-up ${soldOut ? 'opacity-80' : ''}`} style={delay}>
        <Link href={href} className="ns-prod-media" aria-label={product.name}>
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} loading="lazy" />
          ) : (
            <span className="ns-prod-fallback">{product.name.slice(0, 2).toUpperCase()}</span>
          )}
          {tag ? (
            <span className="ns-tag">
              {tag.icon === 'fire' ? (
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
                  <path d="M13 2c.5 3-1.2 4.2-2.6 5.6C8.9 9 7.5 10.6 7.5 13a4.5 4.5 0 0 0 9 0c0-1.2-.4-2.3-1-3.2-.4 1-1 1.6-1.8 1.9.6-3.4-.2-7-1.7-9.7Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
                  <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
                </svg>
              )}
              {tag.label}
            </span>
          ) : null}
          {soldOut ? <span className="ns-tag ns-tag-muted">Agotado</span> : null}
        </Link>

        <div className="ns-prod-body">
          <h3 className="ns-prod-name">
            <Link href={href}>{product.name}</Link>
          </h3>
          <p className="ns-prod-desc">{product.description}</p>
          {duration ? (
            <div className="ns-prod-dur">
              <ProductDurationBadge label={duration} />
            </div>
          ) : null}
          <div className="ns-prod-foot">
            <span className="ns-price">{formatPEN(pricing.priceCents)}</span>
            <Link href={href} className={`ns-buy ${soldOut ? 'is-sold' : ''}`}>
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
                <circle cx="10" cy="20" r="1.3" />
                <circle cx="18" cy="20" r="1.3" />
              </svg>
              {soldOut ? 'Ver' : 'Comprar'}
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <Link
      href={href}
      className={`card-product animate-fade-up group ${soldOut ? 'opacity-80' : ''}`}
      style={delay}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-blue-900/50 via-purple-900/30 to-black">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.07]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-3xl font-black text-purple-300/50">
            {product.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0912] via-transparent to-transparent" />

        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
          {pricing.discountPercent > 0 && (
            <span className="badge badge-danger shadow-lg">-{pricing.discountPercent}%</span>
          )}
          {product.is_featured ? <span className="badge badge-purple">Destacado</span> : null}
        </div>

        <div className="absolute bottom-2.5 right-2.5">
          <StockBadge stock={product.stock} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category_name ? (
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-sky-300/90">
            {product.category_name}
          </span>
        ) : null}
        <h3 className="line-clamp-2 text-[0.98rem] font-bold leading-snug text-white transition group-hover:text-sky-200">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">{product.description}</p>
        {duration ? (
          <div className="pt-0.5">
            <ProductDurationBadge label={duration} />
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <Price priceCents={pricing.priceCents} comparePriceCents={pricing.comparePriceCents} />
            <span className="text-[0.7rem] text-slate-500">
              {product.sold_count > 0 ? `${product.sold_count} vendidos` : 'Nuevo'}
            </span>
          </div>
          <span className={`btn btn-sm ${soldOut ? 'btn-ghost' : 'btn-primary'}`} aria-hidden="true">
            {soldOut ? 'Ver' : 'Comprar'}
          </span>
        </div>
      </div>
    </Link>
  );
}
