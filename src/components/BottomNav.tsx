'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const ICON_CLASS = 'h-[1.35rem] w-[1.35rem]';

const items: NavItem[] = [
  {
    href: '/',
    label: 'Tienda',
    match: (pathname) =>
      pathname === '/' ||
      pathname.startsWith('/productos') ||
      pathname.startsWith('/producto/') ||
      pathname.startsWith('/categoria'),
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 9.5 5 4h14l1.5 5.5" />
        <path d="M3.5 9.5h17V20h-17z" />
        <path d="M3.5 9.5a2.6 2.6 0 0 0 5.2 0 2.6 2.6 0 0 0 5.2 0 2.6 2.6 0 0 0 5.2 0" />
        <path d="M9.5 20v-5.5h5V20" />
      </svg>
    ),
  },
  {
    href: '/carrito',
    label: 'Carrito',
    match: (pathname) => pathname.startsWith('/carrito') || pathname.startsWith('/checkout'),
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
        <circle cx="10" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
      </svg>
    ),
  },
  {
    href: '/cuenta/saldo',
    label: 'Añadir saldo',
    match: (pathname) => pathname.startsWith('/cuenta/saldo'),
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19" />
        <path d="M6 15h4" />
      </svg>
    ),
  },
  {
    href: '/cuenta/pedidos',
    label: 'Compras',
    match: (pathname) => pathname.startsWith('/cuenta/pedidos'),
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 7.5h13l1.2 12.5H4.3L5.5 7.5Z" />
        <path d="M9 7.5a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    href: '/cuenta',
    label: 'Cuenta',
    match: (pathname) => pathname === '/cuenta' || pathname.startsWith('/cuenta/perfil'),
    icon: (
      <svg viewBox="0 0 24 24" className={ICON_CLASS} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6" />
      </svg>
    ),
  },
];

export default function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname() || '/';

  // El panel administrativo es privado y de escritorio: la barra es solo para la tienda.
  if (pathname.startsWith('/admin')) return null;

  const activeHref = items.find((item) => item.match(pathname))?.href;

  return (
    <nav
      aria-label="Navegación de la tienda"
      className="fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:px-4 sm:pb-0"
    >
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-t-[1.6rem] border border-b-0 border-purple-500/25 bg-gradient-to-t from-[#08050f] via-[#0b0716] to-[#140b26]/95 shadow-[0_-14px_40px_-10px_rgba(88,28,135,0.55)] backdrop-blur-xl sm:rounded-[1.6rem] sm:border-b sm:shadow-[0_22px_50px_-16px_rgba(0,0,0,0.85),0_0_30px_-8px_rgba(168,85,247,0.45)]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent"
        />
        <ul className="flex items-stretch gap-0.5 p-1.5">
          {items.map((item) => {
            const active = item.href === activeHref;
            const showBadge = item.href === '/carrito' && cartCount > 0;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  className={[
                    'group relative flex flex-col items-center justify-center gap-1 rounded-[1.1rem] px-1 py-2 text-[0.62rem] font-semibold leading-none transition duration-300',
                    active
                      ? 'bg-gradient-to-b from-purple-500 to-fuchsia-600 text-white shadow-[0_0_22px_rgba(168,85,247,0.6)]'
                      : 'text-purple-200/65 hover:bg-white/5 hover:text-white',
                  ].join(' ')}
                >
                  <span className="relative">
                    {item.icon}
                    {showBadge ? (
                      <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-fuchsia-500 px-1 text-[0.6rem] font-bold text-white ring-2 ring-[#0b0716]">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="w-full truncate text-center">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
