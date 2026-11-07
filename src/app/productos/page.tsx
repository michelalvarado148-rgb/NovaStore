import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import {
  computePricing,
  getActiveOffers,
  getCategories,
  getProducts,
  getSettings,
} from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Catálogo de productos digitales',
};

type SearchParams = Promise<{
  q?: string;
  categoria?: string;
  orden?: string;
  ofertas?: string;
}>;

const SORTS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'popular', label: 'Más vendidos' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
] as const;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const categorySlug = (sp.categoria ?? '').trim();
  const sort = (SORTS.find((s) => s.value === sp.orden)?.value ?? 'recent') as
    | 'recent'
    | 'popular'
    | 'price_asc'
    | 'price_desc';
  const onlyOffers = sp.ofertas === '1';

  const categories = getCategories();
  const offers = getActiveOffers();
  const settings = getSettings();
  const products = getProducts({ search: query || undefined, categorySlug: categorySlug || undefined, sort });
  const visible = onlyOffers
    ? products.filter((p) => computePricing(p, offers).discountPercent > 0)
    : products;
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      q: query || undefined,
      categoria: categorySlug || undefined,
      orden: sort !== 'recent' ? sort : undefined,
      ofertas: onlyOffers ? '1' : undefined,
      ...patch,
    };
    for (const [key, value] of Object.entries(base)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/productos${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="shell py-8">
      <nav className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-purple-300">Inicio</Link>
        <span>/</span>
        <span className="text-slate-300">Catálogo</span>
        {activeCategory ? (
          <>
            <span>/</span>
            <span className="text-purple-300">{activeCategory.name}</span>
          </>
        ) : null}
      </nav>

      <header className="panel relative mb-6 overflow-hidden p-5 sm:p-7">
        <div className="hero-glow right-[-4rem] top-[-5rem] h-56 w-56 bg-purple-600/30" />
        <div className="relative">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {onlyOffers ? 'Ofertas y descuentos' : activeCategory ? activeCategory.name : 'Todos los productos'}
          </h1>
          <p className="muted mt-1 max-w-2xl text-sm">
            {onlyOffers
              ? 'Productos con descuento activo. El precio rebajado se aplica automáticamente.'
              : activeCategory?.description ||
                'Productos digitales originales con entrega tras la verificación del pago.'}
          </p>

          <form action="/productos" className="mt-5 flex flex-col gap-2 sm:flex-row">
            {categorySlug ? <input type="hidden" name="categoria" value={categorySlug} /> : null}
            {onlyOffers ? <input type="hidden" name="ofertas" value="1" /> : null}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Buscar por nombre o descripción..."
              className="input"
              aria-label="Buscar productos"
            />
            <select name="orden" defaultValue={sort} className="select sm:w-52" aria-label="Ordenar por">
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary shrink-0">
              Buscar
            </button>
          </form>
        </div>
      </header>

      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <Link
          href={buildHref({ categoria: undefined })}
          className={`badge whitespace-nowrap px-3 py-2 ${
            categorySlug ? 'badge-muted' : 'badge-purple'
          }`}
        >
          Todas
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={buildHref({ categoria: category.slug })}
            className={`badge whitespace-nowrap px-3 py-2 ${
              categorySlug === category.slug ? 'badge-purple' : 'badge-muted'
            }`}
          >
            {category.name}
          </Link>
        ))}
        <Link
          href={onlyOffers ? buildHref({ ofertas: undefined }) : buildHref({ ofertas: '1' })}
          className={`badge whitespace-nowrap px-3 py-2 ${onlyOffers ? 'badge-danger' : 'badge-muted'}`}
        >
          Solo ofertas
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          {visible.length} resultado{visible.length === 1 ? '' : 's'}
          {query ? ` para “${query}”` : ''}
        </span>
        {query || categorySlug || onlyOffers ? (
          <Link href="/productos" className="link text-xs font-semibold">
            Limpiar filtros
          </Link>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="panel-flat p-10 text-center">
          <p className="text-lg font-bold text-white">No encontramos productos</p>
          <p className="muted mx-auto mt-1 max-w-md text-sm">
            Prueba con otra palabra o revisa todas las categorías disponibles.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/productos" className="btn btn-primary btn-sm">Ver catálogo completo</Link>
            {settings.telegram_url ? (
              <a
                href={settings.telegram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                Pedir por Telegram
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product, i) => (
            <ProductCard key={product.id} product={product} offers={offers} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
