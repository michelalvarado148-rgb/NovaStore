import Link from 'next/link';
import Logo from './Logo';

export default function Footer({ settings }: { settings: Record<string, string> }) {
  const whatsapp = settings.whatsapp_url;
  return (
    <footer className="mt-16 border-t border-purple-500/20 bg-[#07050d]/90">
      <div className="shell grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {settings.store_tagline || 'Tu tienda de productos digitales en Perú'}.
            Compra con Yape, Plin o tarjeta y recibe tu producto tras la verificación del
            comprobante.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="/contacto" className="btn btn-outline btn-sm">
              Contacto
            </a>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm bg-gradient-to-r from-emerald-500 to-green-600 font-bold text-black"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.06c-.25.7-1.45 1.34-2 1.39-.55.05-1.06.24-3.57-.79-3.02-1.24-4.92-4.36-5.07-4.56-.15-.2-1.21-1.62-1.21-3.09 0-1.47.77-2.19 1.04-2.49.27-.3.59-.37.79-.37.2 0 .4.01.57.02.18.01.43-.07.67.51.25.6.85 2.07.92 2.22.07.15.12.32.02.52-.1.2-.2.32-.35.5-.15.17-.31.31-.45.5-.15.2-.31.42-.13.72.18.3.8 1.32 1.72 2.14 1.18 1.05 2.17 1.38 2.47 1.53.3.15.48.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.12.07.72-.18 1.42Z" />
                </svg>
                Canal de WhatsApp
              </a>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-purple-300">
            Tienda
          </h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/productos" className="hover:text-white">Todos los productos</Link></li>
            <li><Link href="/productos?ofertas=1" className="hover:text-white">Ofertas</Link></li>
            <li><Link href="/productos?categoria=juegos" className="hover:text-white">Juegos</Link></li>
            <li><Link href="/productos?categoria=streaming" className="hover:text-white">Streaming</Link></li>
            <li><Link href="/productos?categoria=numeros-virtuales" className="hover:text-white">Números virtuales</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-purple-300">
            Mi cuenta
          </h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link href="/login" className="hover:text-white">Iniciar sesión</Link></li>
            <li><Link href="/registro" className="hover:text-white">Crear cuenta</Link></li>
            <li><Link href="/cuenta" className="hover:text-white">Mi perfil</Link></li>
            <li><Link href="/cuenta/pedidos" className="hover:text-white">Mis pedidos</Link></li>
            <li><Link href="/cuenta/saldo" className="hover:text-white">Mi saldo</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="shell flex flex-col gap-2 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.store_name || 'NOVASTORE'}. Todos los derechos reservados.</p>
          <p className="max-w-xl sm:text-right">{settings.footer_note}</p>
        </div>
      </div>
    </footer>
  );
}
