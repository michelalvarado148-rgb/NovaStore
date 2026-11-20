import Link from 'next/link';
import type { Category } from '@/lib/catalog';

export default function CategoryCard({
  category,
  index = 0,
}: {
  category: Category;
  index?: number;
}) {
  const count = category.product_count ?? 0;

  return (
    <Link
      href={`/categoria/${category.slug}`}
      className="cat-tile group animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {category.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={category.image_url} alt={category.name} loading="lazy" />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060f] via-[#05060f]/65 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="relative p-3.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="grid h-6 w-6 place-items-center rounded-lg border border-sky-400/30 bg-sky-500/15 text-[0.6rem] font-black text-sky-200">
            {category.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-sky-200/80">
            {count} {count === 1 ? 'producto' : 'productos'}
          </span>
        </div>
        <h3 className="text-[0.95rem] font-extrabold leading-tight text-white">{category.name}</h3>
        <span className="mt-1 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-slate-300 transition group-hover:text-sky-200">
          Ver categoría
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
