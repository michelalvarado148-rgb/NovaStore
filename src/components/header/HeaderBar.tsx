'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type HeaderCategory = { id: number | string; name: string; slug: string };

export type HeaderBarProps = {
  storeName: string;
  whatsappUrl?: string;
  cartCount: number;
  categories: HeaderCategory[];
  user: { name: string; role: string } | null;
  logoutSlot?: React.ReactNode;
};

function CartIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </svg>
  );
}

export default function HeaderBar({
  storeName,
  whatsappUrl,
  cartCount,
  categories,
  user,
  logoutSlot,
}: HeaderBarProps) {
  const pathname = usePathname() || '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const name = (storeName || 'NOVASTORE').trim();
  const isNova = name.replace(/\s+/g, '').toUpperCase() === 'NOVASTORE';

  return (
    <header className="ns-header">
      <div className="ns-header-inner">
        <button
          type="button"
          className="ns-icon-btn"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h11" />
          </svg>
        </button>

        <Link href="/" className="ns-logo" aria-label={name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-ns-192.png"
            alt=""
            width={38}
            height={38}
            className="ns-logo-img"
            aria-hidden="true"
          />
          <span className="ns-logo-copy">
            <span className="ns-logo-text">
              {isNova ? (
                <>
                  Nova<b>Store</b>
                </>
              ) : (
                name
              )}
            </span>
            <span className="ns-logo-sub">Tu tienda digital de confianza</span>
          </span>
        </Link>

        <form action="/productos" className="ns-header-search" role="search">
          <div className="ns-search-box">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#7f96ad]" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input type="search" name="q" placeholder="Buscar productos…" aria-label="Buscar productos" />
            <button type="submit" className="ns-search-btn">
              Buscar
            </button>
          </div>
        </form>

        <button
          type="button"
          className="ns-icon-btn"
          aria-label="Buscar"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
        </button>

        <Link href="/carrito" className="ns-icon-btn ns-cart-btn" aria-label={`Carrito con ${cartCount} productos`}>
          <CartIcon />
          <span className="ns-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
        </Link>
      </div>

      {searchOpen ? (
        <form action="/productos" className="ns-search" role="search">
          <div className="ns-search-box">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#7f96ad]" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input
              type="search"
              name="q"
              placeholder="Buscar diamantes, streaming, apps…"
              aria-label="Buscar productos"
              autoFocus
            />
            <button type="submit" className="ns-search-btn">
              Buscar
            </button>
          </div>
        </form>
      ) : null}

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="ns-drawer-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="ns-drawer" aria-label="Menú principal">
            <div className="ns-drawer-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-ns-192.png"
                alt=""
                width={34}
                height={34}
                className="ns-logo-img"
                aria-hidden="true"
              />
              <span className="ns-logo-copy">
                <span className="ns-logo-text">
                  {isNova ? (
                    <>
                      Nova<b>Store</b>
                    </>
                  ) : (
                    name
                  )}
                </span>
                <span className="ns-logo-sub">Menú de la tienda</span>
              </span>
              <button
                type="button"
                className="ns-icon-btn ml-auto"
                aria-label="Cerrar menú"
                onClick={() => setMenuOpen(false)}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col">
              <Link href="/" className="ns-drawer-link">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10.5 12 4l8 6.5V20H4z" />
                  <path d="M9.5 20v-5h5v5" />
                </svg>
                Inicio
              </Link>
              <Link href="/categorias" className="ns-drawer-link">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="7" height="7" rx="1.6" />
                  <rect x="13" y="4" width="7" height="7" rx="1.6" />
                  <rect x="4" y="13" width="7" height="7" rx="1.6" />
                  <rect x="13" y="13" width="7" height="7" rx="1.6" />
                </svg>
                Categorías
              </Link>
              <Link href="/productos?ofertas=1" className="ns-drawer-link">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12 12 20 4 12V4h8z" />
                  <circle cx="8.5" cy="8.5" r="1.3" />
                </svg>
                Ofertas
              </Link>

              <p className="ns-drawer-title">Categorías</p>
              {categories.map((category) => (
                <Link key={category.id} href={`/categoria/${category.slug}`} className="ns-drawer-link">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  {category.name}
                </Link>
              ))}

              <div className="ns-drawer-sep" />
              <Link href="/cuenta/saldo" className="ns-drawer-link">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                  <path d="M2.5 10h19M6 15h4" />
                </svg>
                Añadir saldo
              </Link>
              <Link href="/cuenta/pedidos" className="ns-drawer-link">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5.5 7.5h13l1.2 12.5H4.3L5.5 7.5Z" />
                  <path d="M9 7.5a3 3 0 0 1 6 0" />
                </svg>
                Mis compras
              </Link>
              <Link href="/cuenta/soporte" className="ns-drawer-link">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
                </svg>
                Soporte
              </Link>
              <Link href="/contacto" className="ns-drawer-link">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                Contacto
              </Link>

              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="ns-drawer-link">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.06c-.25.7-1.45 1.34-2 1.39-.55.05-1.06.24-3.57-.79-3.02-1.24-4.92-4.36-5.07-4.56-.15-.2-1.21-1.62-1.21-3.09 0-1.47.77-2.19 1.04-2.49.27-.3.59-.37.79-.37.2 0 .4.01.57.02.18.01.43-.07.67.51.25.6.85 2.07.92 2.22.07.15.12.32.02.52-.1.2-.2.32-.35.5-.15.17-.31.31-.45.5-.15.2-.31.42-.13.72.18.3.8 1.32 1.72 2.14 1.18 1.05 2.17 1.38 2.47 1.53.3.15.48.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.12.07.72-.18 1.42Z" />
                  </svg>
                  Canal de WhatsApp
                </a>
              ) : null}

              <div className="ns-drawer-sep" />
              {user ? (
                <>
                  <Link href={user.role === 'admin' ? '/admin' : '/cuenta'} className="ns-drawer-link">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6" />
                    </svg>
                    {user.role === 'admin' ? 'Panel de administración' : 'Mi cuenta'}
                  </Link>
                  {logoutSlot}
                </>
              ) : (
                <>
                  <Link href="/login" className="ns-drawer-link">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 4h5v16h-5M10 8l4 4-4 4M4 12h10" />
                    </svg>
                    Ingresar
                  </Link>
                  <Link href="/registro" className="ns-drawer-link">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="10" cy="8" r="3.4" />
                      <path d="M3.5 20c0-3.4 3-5.6 6.5-5.6 1.2 0 2.3.2 3.2.7M18 8v6M15 11h6" />
                    </svg>
                    Crear cuenta
                  </Link>
                </>
              )}
            </nav>
          </aside>
        </>
      ) : null}
    </header>
  );
}
