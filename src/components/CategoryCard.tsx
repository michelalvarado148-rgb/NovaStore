import Link from 'next/link';
import type { Category } from '@/lib/catalog';

export default function CategoryCard({
  category,
  index = 0,
}: {
  category: Category;
  index?: number;
}) {
  return (
    <Link
      href={`/productos?categoria=${category.slug}`}
      className="group relative flex min-h-[140px] flex-col justify-end overflow-hidden rounded-2xl border border-purple-500/25 bg-[#100c1b] p-4 animate-fade-up hover-lift"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {category.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={category.image_url}
          alt={category.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-110 group-hover:opacity-90"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[#08060f] via-[#08060f]/70 to-transparent" />
      <div className="relative">
        <h3 className="text-base font-extrabold leading-tight text-white">{category.name}</h3>
        <p className="mt-0.5 text-[0.72rem] text-purple-200/80">
          {category.product_count ?? 0} producto{(category.product_count ?? 0) === 1 ? '' : 's'}
        </p>
      </div>
      <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-purple-400/40 bg-black/40 text-purple-200 opacity-0 transition group-hover:opacity-100">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
