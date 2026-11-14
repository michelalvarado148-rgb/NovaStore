import Link from 'next/link';
import { getCategoryTree } from '@/lib/catalog';
import { saveProductAction } from '@/app/actions/admin';
import ImagePicker from '@/components/admin/ImagePicker';
import ProductNoticeFields from '@/components/admin/ProductNoticeFields';
import type { AdminProduct } from '@/lib/admin';
import type { ProductNotice } from '@/lib/product-notice';
import type { QtyConfig } from '@/lib/custom-quantity';
import { centsToInput } from '@/lib/format';

const VARIANT_ROWS = 5;

export default function ProductForm({
  product,
  variants = [],
  notice = null,
  qtyConfig = null,
}: {
  product?: AdminProduct;
  variants?: { id: number; name: string; price_cents: number | null; stock: number | null }[];
  notice?: ProductNotice | null;
  qtyConfig?: QtyConfig | null;
}) {
  const categories = getCategoryTree({ includeInactive: true });
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
                {category.depth ? `\u21b3 ${category.name} (subcategoría)` : category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="md:col-span-2">
          <ImagePicker
            label="Imagen del producto"
            folder="productos"
            defaultValue={product?.image_url ?? ''}
          />
        </div>

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

      <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-purple-300">
          Productos con cantidad personalizada
        </p>
        <label className="flex items-start gap-2 text-sm text-slate-200">
          <input type="checkbox" name="qty_enabled" defaultChecked={qtyConfig?.enabled ?? false} className="mt-0.5" />
          <span>
            Permitir que el cliente elija la cantidad
            <span className="block text-[0.7rem] text-slate-500">
              Se activa producto por producto y sirve para cualquier producto o servicio de la tienda.
            </span>
          </span>
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>El precio de arriba corresponde a</span>
            <select name="qty_basis" defaultValue={String(qtyConfig?.basis ?? 1)}>
              <option value="1">Cada unidad</option>
              <option value="100">Cada 100 unidades</option>
              <option value="1000">Cada 1000 unidades</option>
            </select>
          </label>

          <label className="field">
            <span>Cantidad mínima</span>
            <input name="qty_min" inputMode="numeric" defaultValue={qtyConfig?.min ?? 1} placeholder="100" />
          </label>

          <label className="field">
            <span>Cantidad máxima (vacío = sin límite)</span>
            <input name="qty_max" inputMode="numeric" defaultValue={qtyConfig?.max ?? ''} placeholder="10000" />
          </label>

          <label className="field">
            <span>Intervalo permitido (de X en X)</span>
            <input name="qty_step" inputMode="numeric" defaultValue={qtyConfig?.step ?? 1} placeholder="100" />
          </label>
        </div>

        <p className="mt-2 text-[0.7rem] leading-relaxed text-slate-500">
          Ejemplo: precio S/ 2.00 cada 100 unidades, mínimo 100, máximo 10 000 e intervalo 100 → el cliente
          podrá comprar 100, 200, 300… hasta 10 000 y el total se calcula automáticamente. La cantidad se
          vuelve a validar en el servidor al agregar al carrito y al confirmar el pedido.
        </p>
      </div>

      <ProductNoticeFields initial={notice} />

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
