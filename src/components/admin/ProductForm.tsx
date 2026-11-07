import Link from 'next/link';
import { getCategories } from '@/lib/catalog';
import { saveProductAction } from '@/app/actions/admin';
import type { AdminProduct } from '@/lib/admin';
import { centsToInput } from '@/lib/format';

const VARIANT_ROWS = 5;

export default function ProductForm({
  product,
  variants = [],
}: {
  product?: AdminProduct;
  variants?: { id: number; name: string; price_cents: number | null; stock: number | null }[];
}) {
  const categories = getCategories(false);
  const rows = Array.from({ length: Math.max(VARIANT_ROWS, variants.length) });

  return (
    <form action={saveProductAction} className="panel space-y-4 p-5">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field md:col-span-2">
          <span>Nombre del producto</span>
          <input name="name" defaultValue={product?.name ?? ''} required minLength={3} maxLength={120} />
        </label>

        <label className="field">
          <span>Categoría</span>
          <select name="category_id" defaultValue={product?.category_id ?? ''}>
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Imagen (URL o ruta)</span>
          <input
            name="image_url"
            defaultValue={product?.image_url ?? ''}
            placeholder="/images/products/ejemplo.svg"
          />
        </label>

        <label className="field md:col-span-2">
          <span>Descripción</span>
          <textarea name="description" rows={4} defaultValue={product?.description ?? ''} />
        </label>

        <label className="field">
          <span>Precio en soles (PEN)</span>
          <input
            name="price"
            inputMode="decimal"
            required
            defaultValue={product ? centsToInput(product.price_cents) : ''}
            placeholder="19.90"
          />
        </label>

        <label className="field">
          <span>Precio anterior (opcional)</span>
          <input
            name="compare_price"
            inputMode="decimal"
            defaultValue={product?.compare_price_cents ? centsToInput(product.compare_price_cents) : ''}
            placeholder="39.90"
          />
        </label>

        <label className="field">
          <span>Stock (vacío = ilimitado)</span>
          <input
            name="stock"
            inputMode="numeric"
            defaultValue={product?.stock ?? ''}
            placeholder="ilimitado"
          />
        </label>

        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="is_active" defaultChecked={product ? product.is_active === 1 : true} />
            Producto visible en la tienda
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="is_featured" defaultChecked={product ? product.is_featured === 1 : false} />
            Mostrar como destacado
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-purple-300">
          Variaciones y presentaciones
        </p>
        <div className="space-y-2">
          {rows.map((_, index) => {
            const variant = variants[index];
            return (
              <div key={index} className="grid gap-2 sm:grid-cols-[1.6fr_1fr_1fr]">
                <input type="hidden" name="variant_id" value={variant?.id ?? 0} />
                <input
                  name="variant_name"
                  defaultValue={variant?.name ?? ''}
                  placeholder={`Presentación ${index + 1} (ej. 1 mes)`}
                />
                <input
                  name="variant_price"
                  inputMode="decimal"
                  defaultValue={variant?.price_cents ? centsToInput(variant.price_cents) : ''}
                  placeholder="Precio (opcional)"
                />
                <input
                  name="variant_stock"
                  inputMode="numeric"
                  defaultValue={variant?.stock ?? ''}
                  placeholder="Stock (opcional)"
                />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[0.7rem] text-slate-500">
          Deja el nombre vacío para no usar esa fila. Si la presentación no tiene precio propio, se usa el
          precio del producto.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">
          {product ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <Link href="/admin/productos" className="btn btn-ghost">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
