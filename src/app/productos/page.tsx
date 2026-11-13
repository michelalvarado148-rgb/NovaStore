import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import {
  computePricing,
  getActiveOffers,
  getCategories,
  getCategoryAncestors,
  getProducts,
  getRootCategories,
  getSettings,
  getSubcategories,
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

  const categories = getRootCategories();
  const allCategories = getCategories();
  const offers = getActiveOffers();
  const settings = getSettings();
  const products = getProducts({ search: query || undefined, categorySlug: categorySlug || undefined, sort });
  const visible = onlyOffers
    ? products.filter((p) => computePricing(p, offers).discountPercent > 0)
    : products;
  const activeCategory = allCategories.find((c) => c.slug === categorySlug) ?? null;
  const subcategories = activeCategory ? getSubcategories(activeCategory.id) : [];
  const ancestors = activeCategory ? getCategoryAncestors(activeCategory) : [];
  const parentCategory = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
  // Dentro de una subcategoría también se ofrecen sus categorías hermanas.
  const siblingCategories = parentCategory ? getSubcategories(parentCategory.id) : [];
  const backHref = parentCategory
    ? `/productos?categoria=${encodeURIComponent(parentCategory.slug)}`
    : '/productos';
  const showingSubcategories = subcategories.length > 0;

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
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-purple-300">Inicio</Link>
        <span>/</span>
        <Link href="/productos" className="hover:text-purple-300">Catálogo</Link>
        {ancestors.map((ancestor) => (
          <span key={ancestor.id} className="flex items-center gap-2">
            <span>/</span>
            <Link href={buildHref({ categoria: ancestor.slug })} className="hover:text-purple-300">
              {ancestor.name}
            </Link>
          </span>
        ))}
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
          {activeCategory ? (
            <Link
              href={backHref}
              className="mb-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-purple-400/50 hover:text-white"
            >
              ← {parentCategory ? parentCategory.name : 'Todas las categorías'}
            </Link>
          ) : null}

          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {onlyOffers ? 'Ofertas y descuentos' : activeCategory ? activeCategory.name : 'Todos los productos'}
          </h1>
          <p className="muted mt-1 max-w-2xl text-sm">
            {onlyOffers
              ? 'Productos con descuento activo. El precio rebajado se aplica automáticamente.'
              : activeCategory?.description ||
                'Productos digitales originales con entrega tras la verificación del pago.'}
          </p>

          {showingSubcategories ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-purple-300">
              Elige una subcategoría para ver los productos
            </p>
          ) : null}

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
        {parentCategory ? (
          <Link
            href={buildHref({ categoria: parentCategory.slug })}
            className={`badge whitespace-nowrap px-3 py-2 ${
              categorySlug === parentCategory.slug ? 'badge-purple' : 'badge-muted'
            }`}
          >
            {parentCategory.name}
          </Link>
        ) : null}
        {siblingCategories.map((sibling) => (
          <Link
            key={sibling.id}
            href={buildHref({ categoria: sibling.slug })}
            className={`badge whitespace-nowrap px-3 py-2 ${
              categorySlug === sibling.slug ? 'badge-purple' : 'badge-muted'
            }`}
          >
            {sibling.name}
          </Link>
        ))}
        <Link
          href={onlyOffers ? buildHref({ ofertas: undefined }) : buildHref({ ofertas: '1' })}
          className={`badge whitespace-nowrap px-3 py-2 ${onlyOffers ? 'badge-danger' : 'badge-muted'}`}
        >
          Solo ofertas
        </Link>
      </div>

      {showingSubcategories ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-purple-300">
            Subcategorías de {activeCategory?.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {subcategories.map((subcategory) => (
              <Link
                key={subcategory.id}
                href={buildHref({ categoria: subcategory.slug })}
                className="group panel overflow-hidden p-0 transition duration-300 hover:-translate-y-0.5 hover:border-purple-400/60"
              >
                <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-purple-700/40 via-purple-900/20 to-black sm:h-32">
                  {subcategory.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={subcategory.image_url}
                      alt={subcategory.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🛍️</div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-bold text-white">{subcategory.name}</p>
                  <p className="muted mt-0.5 line-clamp-2 text-xs">
                    {subcategory.description || 'Ver productos'}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="badge badge-muted text-[10px]">
                      {subcategory.product_count ?? 0} producto{subcategory.product_count === 1 ? '' : 's'}
                    </span>
                    <span className="text-[11px] font-semibold text-purple-300 transition group-hover:text-white">
                      Ver →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          {showingSubcategories
            ? `${subcategories.length} subcategoría${subcategories.length === 1 ? '' : 's'}`
            : `${visible.length} resultado${visible.length === 1 ? '' : 's'}`}
          {query ? ` para “${query}”` : ''}
        </span>
        {query || categorySlug || onlyOffers ? (
          <Link href="/productos" className="link text-xs font-semibold">
            Limpiar filtros
          </Link>
        ) : null}
      </div>

      {visible.length > 0 ? (
        showingSubcategories ? (
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-purple-300">
            Productos en {activeCategory?.name}
          </h2>
        ) : null
      ) : null}

      {visible.length === 0 ? (
        showingSubcategories ? (
          <div className="panel-flat p-8 text-center">
            <p className="text-base font-bold text-white">Elige una subcategoría</p>
            <p className="muted mx-auto mt-1 max-w-md text-sm">
              Los productos de {activeCategory?.name} están organizados por subcategoría.
            </p>
          </div>
        ) : (
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
        )
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
