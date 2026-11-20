import Link from 'next/link';
import { computePricing, type Offer, type Product } from '@/lib/catalog';
import { formatPEN } from '@/lib/format';

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

export type ProductCardVariant = 'grid' | 'compact' | 'row';

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
}: {
  product: Product;
  offers: Offer[];
  index?: number;
  variant?: ProductCardVariant;
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
          <div className="mt-auto pt-1.5">
            <Price priceCents={pricing.priceCents} comparePriceCents={pricing.comparePriceCents} size="sm" />
          </div>
        </div>
      </Link>
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
