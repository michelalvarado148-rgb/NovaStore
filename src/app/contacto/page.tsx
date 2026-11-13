import Link from 'next/link';
import { getPaymentMethods, getSettings } from '@/lib/catalog';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contacto y soporte' };

export default async function ContactPage() {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const settings = getSettings();
  const methods = getPaymentMethods(true);

  const channels = [
    {
      title: 'Canal de Telegram',
      text: 'Novedades, ofertas y soporte rápido con nuestro equipo.',
      href: settings.telegram_url,
      cta: 'Abrir Telegram',
    },
    {
      title: 'Correo de soporte',
      text: settings.contact_email || 'Escríbenos y te responderemos a la brevedad.',
      href: settings.contact_email ? `mailto:${settings.contact_email}` : '',
      cta: 'Enviar correo',
    },
    {
      title: 'WhatsApp / Teléfono',
      text: settings.contact_phone || 'Atención directa en horario extendido.',
      href: settings.contact_phone
        ? `https://wa.me/51${settings.contact_phone.replace(/\D/g, '')}`
        : '',
      cta: 'Escribir por WhatsApp',
    },
  ].filter((channel) => channel.href);

  return (
    <div className="shell py-10">
      <header className="panel relative overflow-hidden p-6 sm:p-10">
        <div className="hero-glow right-[-4rem] top-[-4rem] h-64 w-64 bg-purple-600/30" />
        <div className="relative max-w-2xl">
          <span className="badge badge-purple mb-3">Atención al cliente</span>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Estamos para ayudarte
          </h1>
          <p className="muted mt-3 text-sm leading-relaxed">
            ¿Tienes dudas sobre un producto, tu pedido o tu comprobante? Escríbenos por cualquiera de
            nuestros canales. Horario de atención: {settings.support_hours || 'todos los días'}.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel) => (
          <a
            key={channel.title}
            href={channel.href}
            target={channel.href.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="panel hover-lift p-5"
          >
            <h2 className="text-base font-bold text-white">{channel.title}</h2>
            <p className="mt-1 break-words text-sm text-slate-400">{channel.text}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-purple-300">
              {channel.cta} →
            </span>
          </a>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Métodos de pago aceptados
          </h2>
          <ul className="mt-3 space-y-2">
            {methods.map((method) => (
              <li key={method.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-sm font-bold text-white">{method.name}</p>
                <p className="text-xs text-slate-400">{method.description}</p>
                {method.account_info ? (
                  <p className="mt-1 text-xs font-semibold text-purple-200">{method.account_info}</p>
                ) : null}
              </li>
            ))}
            {methods.length === 0 ? (
              <li className="text-sm text-slate-400">
                Aún no hay métodos de pago configurados. Contáctanos por Telegram.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Preguntas frecuentes
          </h2>
          <div className="mt-3 space-y-2">
            {[
              {
                q: '¿Cuándo recibo mi producto?',
                a: 'El pedido queda pendiente hasta que verificamos tu comprobante. Una vez aprobado, se marca como entregado y recibirás los datos por el correo o teléfono que registraste.',
              },
              {
                q: '¿Los pagos se aprueban automáticamente?',
                a: 'No. Todos los pagos son revisados manualmente por un administrador para proteger tu compra.',
              },
              {
                q: '¿Puedo comprar sin cuenta?',
                a: 'Puedes armar tu carrito, pero para confirmar el pedido necesitas una cuenta así protegemos tu historial y tu comprobante.',
              },
              {
                q: '¿Puedo usar mi saldo?',
                a: 'Sí, los administradores pueden acreditar saldo a tu cuenta y verás todos los movimientos en tu perfil.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="rounded-xl border border-purple-500/20 bg-black/30 p-3 open:border-purple-400/50"
              >
                <summary className="cursor-pointer text-sm font-semibold text-white">{item.q}</summary>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link href="/productos" className="btn btn-primary">Ver catálogo de productos</Link>
      </div>
    </div>
  );
}
