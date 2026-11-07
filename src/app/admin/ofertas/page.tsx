import { listAdminOffers } from '@/lib/admin';
import { getCategories } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { deleteOfferAction, saveOfferAction, toggleOfferAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gestión de ofertas' };

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const offers = listAdminOffers();
  const categories = getCategories(false);
  const products = getDb()
    .prepare('SELECT id, name FROM products ORDER BY name ASC')
    .all() as { id: number; name: string }[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">Ofertas y descuentos ({offers.length})</h1>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <form action={saveOfferAction} className="panel grid gap-3 p-5 md:grid-cols-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-300 md:col-span-2">
          Nueva oferta
        </h2>
        <label className="field">
          <span>Título</span>
          <input name="title" required minLength={3} placeholder="Ej. Semana gamer" />
        </label>
        <label className="field">
          <span>Descuento (%)</span>
          <input name="discount_percent" inputMode="numeric" required defaultValue="15" />
        </label>
        <label className="field">
          <span>Aplicar a producto (opcional)</span>
          <select name="product_id" defaultValue="">
            <option value="">— Ninguno —</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Aplicar a categoría (opcional)</span>
          <select name="category_id" defaultValue="">
            <option value="">— Ninguna —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Inicia (opcional)</span>
          <input name="starts_at" type="datetime-local" />
        </label>
        <label className="field">
          <span>Termina (opcional)</span>
          <input name="ends_at" type="datetime-local" />
        </label>
        <label className="field md:col-span-2">
          <span>Descripción</span>
          <input name="description" placeholder="Texto que verá el cliente" maxLength={180} />
        </label>
        <div className="flex items-center gap-3 md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="is_active" defaultChecked /> Activa
          </label>
          <button type="submit" className="btn btn-primary btn-sm">Crear oferta</button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {offers.map((offer) => (
          <div key={offer.id} className="panel space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">{offer.title}</p>
              <span className={`badge ${offer.is_active ? 'badge-success' : 'badge-muted'}`}>
                {offer.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <p className="text-xs text-purple-200">-{offer.discount_percent}% de descuento</p>
            <p className="text-[0.7rem] text-slate-400">
              {offer.product_name ? `Producto: ${offer.product_name}` : null}
              {offer.category_name ? `Categoría: ${offer.category_name}` : null}
              {!offer.product_name && !offer.category_name ? 'Aplica a todo el catálogo' : null}
            </p>
            {offer.description ? <p className="text-xs text-slate-400">{offer.description}</p> : null}
            <div className="flex gap-2 pt-1">
              <form action={toggleOfferAction}>
                <input type="hidden" name="id" value={offer.id} />
                <button type="submit" className="btn btn-outline btn-xs">
                  {offer.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </form>
              <form action={deleteOfferAction}>
                <input type="hidden" name="id" value={offer.id} />
                <button type="submit" className="btn btn-danger btn-xs">Eliminar</button>
              </form>
            </div>
          </div>
        ))}
        {offers.length === 0 ? (
          <p className="panel p-5 text-sm text-slate-400 md:col-span-2">
            Todavía no hay ofertas creadas.
          </p>
        ) : null}
      </div>
    </div>
  );
}
