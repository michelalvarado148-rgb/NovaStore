import Link from 'next/link';
import Logo from './Logo';

export default function Footer({ settings }: { settings: Record<string, string> }) {
  const telegram = settings.telegram_url;
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
            {telegram ? (
              <a
                href={telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
              >
                Canal de Telegram
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
