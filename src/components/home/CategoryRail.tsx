import Link from 'next/link';
import type { Category } from '@/lib/catalog';

type CategoryRailProps = {
  categories: Category[];
};

function initials(name: string) {
  const clean = name.trim();
  if (!clean) return '★';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function CategoryRail({ categories }: CategoryRailProps) {
  if (categories.length === 0) {
    return <p className="ns-empty">Todavía no hay categorías publicadas.</p>;
  }

  return (
    <div className="ns-rail">
      {categories.map((category) => (
        <Link key={category.id} href={`/categoria/${category.slug}`} className="ns-cat">
          <span className="ns-cat-thumb">
            {category.image_url ? (
              <img src={category.image_url} alt={category.name} loading="lazy" />
            ) : (
              <span className="ns-cat-initial">{initials(category.name)}</span>
            )}
          </span>
          <span className="ns-cat-name">{category.name}</span>
        </Link>
      ))}

      <Link href="/productos?ofertas=1" className="ns-cat">
        <span className="ns-cat-thumb">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12 12 20 4 12V4h8z" />
            <circle cx="8.5" cy="8.5" r="1.4" />
          </svg>
        </span>
        <span className="ns-cat-name">Ofertas</span>
      </Link>
    </div>
  );
}
