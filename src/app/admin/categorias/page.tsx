import { getCategoryTree } from '@/lib/catalog';
import { listAdminProducts } from '@/lib/admin';
import { deleteCategoryAction, moveProductsAction, saveCategoryAction } from '@/app/actions/admin';
import ImagePicker from '@/components/admin/ImagePicker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gestión de categorías' };

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const tree = getCategoryTree({ includeInactive: true });
  const roots = tree.filter((category) => (category.depth ?? 0) === 0);
  const subcategoryCount = tree.length - roots.length;
  const products = listAdminProducts();

  const productsByCategory = new Map<number, typeof products>();
  for (const product of products) {
    if (product.category_id === null) continue;
    const list = productsByCategory.get(product.category_id) ?? [];
    list.push(product);
    productsByCategory.set(product.category_id, list);
  }
  const categoriesWithProducts = tree.filter((category) => productsByCategory.has(category.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-black text-white">Categorías ({roots.length})</h1>
        <span className="badge badge-purple">{subcategoryCount} subcategoría(s)</span>
      </div>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <form action={saveCategoryAction} className="panel grid gap-3 p-5 md:grid-cols-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-300 md:col-span-2">
          Nueva categoría o subcategoría
        </h2>
        <label className="field">
          <span>Nombre</span>
          <input name="name" required minLength={3} maxLength={60} placeholder="Ej. Free Fire" />
        </label>
        <label className="field">
          <span>Pertenece a</span>
          <select name="parent_id" defaultValue="">
            <option value="">Categoría principal (nivel 1)</option>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                Subcategoría de {root.name}
              </option>
            ))}
          </select>
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
          <button type="submit" className="btn btn-primary btn-sm">Crear</button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {tree.map((category) => {
          const isSubcategory = (category.depth ?? 0) > 0;
          return (
            <div
              key={category.id}
              className={`panel p-4 ${isSubcategory ? 'md:ml-6 border-l-2 border-purple-500/40' : ''}`}
            >
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
                <label className="field">
                  <span>Pertenece a</span>
                  <select name="parent_id" defaultValue={category.parent_id ?? ''}>
                    <option value="">Categoría principal (nivel 1)</option>
                    {roots
                      .filter((root) => root.id !== category.id)
                      .map((root) => (
                        <option key={root.id} value={root.id}>
                          Subcategoría de {root.name}
                        </option>
                      ))}
                  </select>
                </label>
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
                  <span className="badge badge-purple text-[10px]">
                    {isSubcategory ? 'Subcategoría' : 'Principal'}
                  </span>
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
          );
        })}
      </div>

      <section className="panel space-y-3 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-300">
          Asignar productos a subcategorías
        </h2>
        <p className="muted text-xs">
          Selecciona los productos de una categoría y elige la subcategoría de destino. Los productos se
          mueven sin duplicarse y conservan su información, imágenes y precios.
        </p>
        {categoriesWithProducts.length === 0 ? (
          <p className="muted text-sm">Todavía no hay productos asignados a ninguna categoría.</p>
        ) : (
          <div className="space-y-2">
            {categoriesWithProducts.map((category) => {
              const list = productsByCategory.get(category.id) ?? [];
              return (
                <details key={category.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <summary className="cursor-pointer text-sm font-bold text-white">
                    {category.depth ? `↳ ${category.name}` : category.name}
                    <span className="badge badge-muted ml-2">{list.length} producto(s)</span>
                  </summary>
                  <form action={moveProductsAction} className="mt-3 space-y-2">
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                      {list.map((product) => (
                        <label
                          key={product.id}
                          className="flex items-center gap-2 text-xs text-slate-300"
                        >
                          <input type="checkbox" name="product_ids" value={product.id} />
                          <span className="truncate">{product.name}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="field flex-1">
                        <span>Mover a</span>
                        <select name="target_category_id" defaultValue="" required>
                          <option value="" disabled>Elige la subcategoría de destino</option>
                          {tree
                            .filter((target) => target.id !== category.id)
                            .map((target) => (
                              <option key={target.id} value={target.id}>
                                {target.depth ? `↳ ${target.name}` : target.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button type="submit" className="btn btn-primary btn-sm">Mover seleccionados</button>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
