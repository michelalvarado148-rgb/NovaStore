import ProductForm from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nuevo producto' };

export default function NewProductPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">Nuevo producto</h1>
      <ProductForm />
    </div>
  );
}
