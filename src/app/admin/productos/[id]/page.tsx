import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';
import { listAdminProducts } from '@/lib/admin';
import { getProductNoticeConfig } from '@/lib/product-notice';
import { getVariants } from '@/lib/catalog';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar producto' };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = listAdminProducts().find((item) => item.id === Number(id));
  if (!product) notFound();

  const variants = getDb()
    .prepare(
      'SELECT id, name, price_cents, stock FROM product_variants WHERE product_id = ? ORDER BY position ASC, id ASC',
    )
    .all(product.id) as { id: number; name: string; price_cents: number | null; stock: number | null }[];

  void getVariants;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-white">Editar: {product.name}</h1>
        <Link href="/admin/productos" className="btn btn-ghost btn-sm">
          Volver
        </Link>
      </div>
      <ProductForm product={product} variants={variants} notice={getProductNoticeConfig(product.id)} />
    </div>
  );
}
