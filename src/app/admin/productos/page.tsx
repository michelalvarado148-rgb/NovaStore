import Link from 'next/link';
import { listAdminProducts } from '@/lib/admin';
import { getNoticeConfigMap } from '@/lib/product-notice';
import { deleteProductAction } from '@/app/actions/admin';
import { formatPEN } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gestión de productos' };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const products = listAdminProducts();
  const noticeMap = getNoticeConfigMap();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-white">Productos ({products.length})</h1>
        <Link href="/admin/productos/nuevo" className="btn btn-primary btn-sm">
          + Nuevo producto
        </Link>
      </div>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    ) : null}
                    <div>
                      <p className="font-semibold text-white">
                        {product.name}
                        {noticeMap.get(product.id)?.enabled ? (
                          <span className="ml-1.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 align-middle text-[0.6rem] font-bold text-fuchsia-200">
                            AVISO
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[0.7rem] text-slate-500">
                        {product.sold_count} vendidos {product.is_featured ? '· destacado' : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-slate-300">{product.category_name ?? '—'}</td>
                <td className="whitespace-nowrap text-slate-200">{formatPEN(product.price_cents)}</td>
                <td>
                  {product.stock === null ? (
                    <span className="badge badge-success">Ilimitado</span>
                  ) : product.stock > 0 ? (
                    <span className="badge badge-info">{product.stock}</span>
                  ) : (
                    <span className="badge badge-danger">Agotado</span>
                  )}
                </td>
                <td>
                  {product.is_active ? (
                    <span className="badge badge-success">Visible</span>
                  ) : (
                    <span className="badge badge-muted">Oculto</span>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/productos/${product.id}`} className="btn btn-ghost btn-xs">
                      Editar
                    </Link>
                    <form action={deleteProductAction}>
                      <input type="hidden" name="id" value={product.id} />
                      <button type="submit" className="btn btn-danger btn-xs">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                  Todavía no hay productos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
