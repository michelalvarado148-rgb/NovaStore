import ImagePicker from '@/components/admin/ImagePicker';
import { mediaStorageMode } from '@/lib/media';
import { getPaymentQrUrl } from '@/lib/payment-qr';
import { clearPaymentQrAction, savePaymentQrAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR de pago' };

export default async function AdminPaymentQrPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const qrUrl = getPaymentQrUrl();
  const storage = mediaStorageMode();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-white">QR de pago</h1>
        <p className="muted mt-1 text-sm">
          Sube el QR de tu cuenta (Yape, Plin o banco). Los clientes lo verán al añadir saldo y
          podrán escanearlo con su celular para pagar.
        </p>
      </div>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <section className="panel space-y-4 p-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="rounded-2xl bg-white p-3">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt="QR de pago configurado actualmente"
                className="h-44 w-44 object-contain"
              />
            ) : (
              <div className="grid h-44 w-44 place-items-center px-3 text-center text-[0.7rem] leading-snug text-slate-500">
                Todavía no hay un QR configurado
              </div>
            )}
          </div>

          <div className="min-w-[12rem] flex-1 space-y-2">
            <span className={qrUrl ? 'badge badge-success' : 'badge badge-warning'}>
              {qrUrl ? 'QR activo' : 'QR sin configurar'}
            </span>
            <p className="text-xs text-slate-400">
              {qrUrl
                ? 'Este es el QR que ven los clientes ahora mismo en «Añadir saldo». Para cambiarlo, sube otra imagen y guarda.'
                : 'Mientras no subas una imagen, los clientes verán un aviso de que el QR todavía no está disponible. No se usa ningún QR de ejemplo.'}
            </p>
            <p className="text-[0.7rem] leading-snug text-slate-500">
              {storage === 'bucket'
                ? 'La imagen se guarda en Supabase Storage (bucket ' + 'novastore-media' + ') y la URL queda en la configuración de la tienda.'
                : 'La imagen se guarda de forma permanente en Supabase (tabla de configuración) y se sirve desde esta misma tienda.'}
            </p>
          </div>
        </div>

        <form action={savePaymentQrAction} className="space-y-3 border-t border-white/5 pt-4">
          <ImagePicker
            name="payment_qr_url"
            label="Imagen del QR de pago"
            folder="pagos"
            defaultValue={qrUrl}
          />
          <button type="submit" className="btn btn-primary">
            Guardar QR de pago
          </button>
        </form>

        {qrUrl ? (
          <form action={clearPaymentQrAction} className="border-t border-white/5 pt-4">
            <button type="submit" className="btn btn-danger btn-sm">
              Eliminar QR de pago
            </button>
            <p className="mt-2 text-[0.7rem] text-slate-500">
              Al eliminarlo, los clientes volverán a ver el aviso de que el QR no está disponible.
            </p>
          </form>
        ) : null}
      </section>

      <section className="panel space-y-2 p-5 text-xs text-slate-400">
        <p className="text-sm font-bold text-white">Cómo funciona</p>
        <p>1. Sube una captura nítida de tu QR (JPG, PNG o WEBP) desde la galería del dispositivo.</p>
        <p>2. Guarda el QR: queda visible al instante en «Añadir saldo» para todos los clientes.</p>
        <p>
          3. El cliente escanea el QR, paga el monto que indicó y adjunta su comprobante. El saldo
          se acredita solo cuando verificas el comprobante en Recargas.
        </p>
        <p className="text-slate-500">
          Solo el administrador puede ver y cambiar este QR; los clientes únicamente lo visualizan.
        </p>
      </section>
    </div>
  );
}
