import { getCategories } from '@/lib/catalog';
import { deleteCategoryAction, saveCategoryAction } from '@/app/actions/admin';
import ImagePicker from '@/components/admin/ImagePicker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gestión de categorías' };

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const categories = getCategories({ includeInactive: true });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">Categorías ({categories.length})</h1>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <form action={saveCategoryAction} className="panel grid gap-3 p-5 md:grid-cols-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-300 md:col-span-2">
          Nueva categoría
        </h2>
        <label className="field">
          <span>Nombre</span>
          <input name="name" required minLength={3} maxLength={60} placeholder="Ej. Juegos" />
        </label>
        <div className="md:col-span-2">
          <ImagePicker label="Imagen de la categoría" folder="categorias" />
        </div>
        <label className="field md:col-span-2">
          <span>Descripción</span>
          <input name="description" maxLength={200} placeholder="Describe brevemente la categoría" />
        </label>
        <label className="field">
          <span>Posición</span>
          <input name="position" inputMode="numeric" defaultValue="0" />
        </label>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="is_active" defaultChecked /> Visible
          </label>
          <button type="submit" className="btn btn-primary btn-sm">Crear categoría</button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {categories.map((category) => (
          <div key={category.id} className="panel p-4">
            <form action={saveCategoryAction} className="space-y-2">
              <input type="hidden" name="id" value={category.id} />
              <div className="flex items-center gap-2">
                {category.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={category.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : null}
                <input name="name" defaultValue={category.name} className="flex-1" />
              </div>
              <input
                name="description"
                defaultValue={category.description}
                placeholder="Descripción"
              />
              <ImagePicker
                label="Imagen"
                folder="categorias"
                defaultValue={category.image_url ?? ''}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  Posición
                  <input name="position" defaultValue={category.position} className="w-16" inputMode="numeric" />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" name="is_active" defaultChecked={category.is_active === 1} /> Visible
                </label>
                <span className="badge badge-muted">{category.product_count ?? 0} productos</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn btn-primary btn-xs">Guardar</button>
              </div>
            </form>
            <form action={deleteCategoryAction} className="mt-2">
              <input type="hidden" name="id" value={category.id} />
              <button type="submit" className="btn btn-danger btn-xs">Eliminar</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
