import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getPushState } from '@/lib/push';
import PushNotificationsManager from '@/components/admin/PushNotificationsManager';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notificaciones push',
  robots: { index: false, follow: false },
};

const EVENTOS = [
  {
    icon: '🛒',
    title: 'Nuevo pedido',
    detail: 'Cada compra de un cliente avisa con el número de pedido, el importe y el método de pago.',
  },
  {
    icon: '💰',
    title: 'Nueva recarga',
    detail: 'Cuando un cliente solicita recargar saldo y adjunta su comprobante, llega el importe y queda pendiente de aprobación.',
  },
  {
    icon: '💳',
    title: 'Nuevo comprobante',
    detail: 'Los pagos con Yape, Plin o tarjeta que adjuntan comprobante generan su propio aviso para revisión.',
  },
];

export default async function AdminNotificationsPage() {
  await requireAdmin('/admin/notificaciones');
  const state = getPushState();

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-purple-500/25 bg-[#0e0a1a]/80 p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
          Panel administrativo
        </p>
        <h1 className="mt-1 text-2xl font-black text-white">Notificaciones push</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Avisos reales en tu teléfono, también con la tienda cerrada. Se envían únicamente a los
          dispositivos que autorices en esta página y se guardan en la base de datos de NOVASTORE.
        </p>
      </header>

      <PushNotificationsManager
        enabled={state.enabled}
        devices={state.devices}
        lastSentAt={state.lastSentAt}
        publicKey={state.publicKey}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {EVENTOS.map((evento) => (
          <article
            key={evento.title}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"
          >
            <p className="text-2xl">{evento.icon}</p>
            <h2 className="mt-2 text-sm font-black uppercase tracking-wide text-white">
              {evento.title}
            </h2>
            <p className="mt-1 text-sm text-slate-300">{evento.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <h2 className="text-sm font-black uppercase tracking-wide text-white">Cómo funciona</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>
            • Al tocar la notificación, NOVASTORE se abre en el pedido, la recarga o los comprobantes
            correspondientes.
          </li>
          <li>
            • Cada pedido, recarga y comprobante genera un único aviso: no se repiten aunque la
            página se recargue.
          </li>
          <li>
            • Puedes desactivar las notificaciones desde este panel cuando quieras; el dispositivo se
            elimina de la lista.
          </li>
          <li>
            • Los avisos no se envían a clientes: solo a los dispositivos autorizados por el
            administrador.
          </li>
          <li>
            • Si tu teléfono deja de recibirlos, vuelve a activarlos aquí: el navegador puede renovar
            la suscripción.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/pedidos" className="btn btn-ghost btn-sm">
            Ver pedidos
          </Link>
          <Link href="/admin/recargas" className="btn btn-ghost btn-sm">
            Ver recargas
          </Link>
          <Link href="/admin/comprobantes" className="btn btn-ghost btn-sm">
            Ver comprobantes
          </Link>
        </div>
      </section>
    </div>
  );
}
