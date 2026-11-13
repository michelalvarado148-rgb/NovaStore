import Link from 'next/link';
import Logo from './Logo';
import { getCurrentUser } from '@/lib/auth';
import { getCartCount } from '@/lib/cart';
import { getCategories } from '@/lib/catalog';

export default async function Header({
  storeName,
  telegramUrl,
}: {
  storeName: string;
  telegramUrl?: string;
}) {
  const [user, cartCount, categories] = await Promise.all([
    getCurrentUser(),
    getCartCount(),
    Promise.resolve(getCategories()),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-purple-500/20 bg-[#06050b]/85 backdrop-blur-xl">
      <div className="shell flex items-center gap-3 py-3">
        <Link href="/" aria-label={storeName} className="shrink-0">
          <Logo />
        </Link>

        <form action="/productos" className="ml-2 hidden flex-1 items-center md:flex">
          <div className="relative w-full">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/70"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input
              type="search"
              name="q"
              placeholder="Buscar gift cards, streaming, apps..."
              className="input pl-10"
              aria-label="Buscar productos"
            />
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-2">
          <Link
            href="/productos?ofertas=1"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/10 hover:text-white lg:block"
          >
            Ofertas
          </Link>
          {telegramUrl ? (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm hidden sm:inline-flex"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M21.9 4.3 19 19.2c-.2 1-.8 1.2-1.6.8l-4.4-3.3-2.1 2c-.2.2-.4.4-.9.4l.3-4.5 8.2-7.4c.4-.3-.1-.5-.6-.2L7.8 13.1l-4.3-1.4c-.9-.3-.9-.9.2-1.3l16.7-6.4c.8-.3 1.5.2 1.5 1.3Z" />
              </svg>
              Telegram
            </a>
          ) : null}

          <Link href="/carrito" className="relative btn btn-ghost btn-sm" aria-label="Carrito de compras">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
              <circle cx="10" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1 text-[0.65rem] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <Link
              href={user.role === 'admin' ? '/admin' : '/cuenta'}
              className="btn btn-primary btn-sm"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.4" />
                <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
              </svg>
              <span className="max-w-[9rem] truncate">{user.role === 'admin' ? 'Panel' : user.name.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm">
              Ingresar
            </Link>
          )}
        </nav>
      </div>

      <div className="border-t border-white/5 bg-[#08060f]/70">
        <div className="shell no-scrollbar flex items-center gap-1 overflow-x-auto py-1.5 text-sm">
          <Link
            href="/productos"
            className="whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold text-purple-200 transition hover:bg-purple-500/10 hover:text-white"
          >
            Todos los productos
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/productos?categoria=${category.slug}`}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-purple-500/10 hover:text-white"
            >
              {category.name}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/cuenta/pedidos"
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-purple-500/10 hover:text-white"
              >
                Mis compras
              </Link>
              <Link
                href="/cuenta/saldo"
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-purple-500/10 hover:text-white"
              >
                Añadir saldo
              </Link>
              <Link
                href="/cuenta/soporte"
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-purple-500/10 hover:text-white"
              >
                Soporte
              </Link>
            </>
          ) : null}
          <Link
            href="/contacto"
            className="ml-auto hidden whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/10 hover:text-white sm:block"
          >
            Contacto
          </Link>
        </div>
      </div>

      <form action="/productos" className="shell pb-2 md:hidden">
        <input
          type="search"
          name="q"
          placeholder="Buscar productos..."
          className="input py-2 text-sm"
          aria-label="Buscar productos"
        />
      </form>
    </header>
  );
}
