import Link from 'next/link';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';
import { getRootCategories } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categorías' };

function initials(name: string) {
  const clean = name.trim();
  if (!clean) return '★';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default async function CategoriesPage() {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const categories = getRootCategories();

  return (
    <div className="ns-home">
      <div className="ns-shell pt-4">
        <h1 className="ns-page-title">Categorías</h1>
        <p className="ns-page-sub">Elige una categoría para ver sus productos.</p>

        {categories.length === 0 ? (
          <p className="ns-empty mt-4">Todavía no hay categorías publicadas.</p>
        ) : (
          <div className="ns-cat-grid">
            {categories.map((category) => (
              <Link key={category.id} href={`/categoria/${category.slug}`} className="ns-cat-card">
                <span className="ns-cat-card-media">
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} loading="lazy" />
                  ) : (
                    <span>{initials(category.name)}</span>
                  )}
                </span>
                <span className="ns-cat-card-name">{category.name}</span>
              </Link>
            ))}
          </div>
        )}

        <Link href="/productos?ofertas=1" className="ns-cat-card mt-4 block">
          <span className="ns-cat-card-media">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12 12 20 4 12V4h8z" />
              <circle cx="8.5" cy="8.5" r="1.4" />
            </svg>
          </span>
          <span className="ns-cat-card-name">Ofertas y descuentos</span>
        </Link>
      </div>
    </div>
  );
}
