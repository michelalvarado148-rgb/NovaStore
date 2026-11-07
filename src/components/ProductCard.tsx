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

export default function ProductCard({
  product,
  offers,
  index = 0,
}: {
  product: Product;
  offers: Offer[];
  index?: number;
}) {
  const pricing = computePricing(product, offers);
  const soldOut = product.stock !== null && product.stock <= 0;

  return (
    <Link
      href={`/producto/${product.slug}`}
      className={`card-product animate-fade-up group ${soldOut ? 'opacity-80' : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-violet-900/60 via-purple-900/30 to-black">
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
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-purple-300/90">
            {product.category_name}
          </span>
        ) : null}
        <h3 className="line-clamp-2 text-[0.98rem] font-bold leading-snug text-white transition group-hover:text-purple-200">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">{product.description}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white">{formatPEN(pricing.priceCents)}</span>
              {pricing.comparePriceCents && pricing.comparePriceCents > pricing.priceCents ? (
                <span className="text-xs text-slate-500 line-through">
                  {formatPEN(pricing.comparePriceCents)}
                </span>
              ) : null}
            </div>
            <span className="text-[0.7rem] text-slate-500">
              {product.sold_count > 0 ? `${product.sold_count} vendidos` : 'Nuevo'}
            </span>
          </div>
          <span
            className={`btn btn-sm ${soldOut ? 'btn-ghost' : 'btn-primary'}`}
            aria-hidden="true"
          >
            {soldOut ? 'Ver' : 'Comprar'}
          </span>
        </div>
      </div>
    </Link>
  );
}
