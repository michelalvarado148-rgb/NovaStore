import Link from 'next/link';
import { getPendingProofs } from '@/lib/orders';
import { formatDateTime, formatPEN } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verificación de comprobantes' };

export default async function AdminProofsPage() {
  const pending = getPendingProofs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-white">Comprobantes por verificar ({pending.length})</h1>
        <p className="text-sm text-slate-400">
          Los pedidos permanecen con pago pendiente hasta que verifiques el comprobante. Ningún pago se
          aprueba automáticamente.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="panel p-6 text-sm text-slate-400">
          No hay comprobantes pendientes de revisión en este momento.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map((order) => (
            <div key={order.id} className="panel space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-white">{order.order_number}</p>
                <span className="badge badge-warning">Pago pendiente</span>
              </div>
              <p className="text-sm text-slate-200">{order.customer_name}</p>
              <p className="text-[0.7rem] text-slate-500">
                {order.customer_email} · {formatDateTime(order.created_at)}
              </p>
              <p className="text-lg font-black text-white">{formatPEN(order.total_cents)}</p>
              <p className="text-xs text-slate-400">Método: {order.payment_method}</p>
              <div className="flex gap-2">
                <Link href={`/admin/pedidos/${order.id}`} className="btn btn-primary btn-sm">
                  Revisar comprobante
                </Link>
                {order.has_proof ? (
                  <span className="badge badge-info self-center">Imagen adjunta</span>
                ) : (
                  <span className="badge badge-muted self-center">Sin imagen</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
