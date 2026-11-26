'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  matches: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const iconProps = {
  className: 'h-[1.15rem] w-[1.15rem]',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname() || '/';

  const items: NavItem[] = [
    {
      href: '/',
      label: 'Inicio',
      matches: (path) => path === '/',
      icon: (
        <svg viewBox="0 0 24 24" {...iconProps}>
          <path d="M4 10.5 12 4l8 6.5V20H4z" />
          <path d="M9.5 20v-5h5v5" />
        </svg>
      ),
    },
    {
      href: '/cuenta/pedidos',
      label: 'Mis compras',
      matches: (path) => path.startsWith('/cuenta/pedidos') || path.startsWith('/pedido/'),
      icon: (
        <svg viewBox="0 0 24 24" {...iconProps}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M9 9h6M9 13h6M9 17h4" />
        </svg>
      ),
    },
    {
      href: '/carrito',
      label: 'Carrito',
      matches: (path) => path.startsWith('/carrito') || path.startsWith('/checkout'),
      icon: (
        <svg viewBox="0 0 24 24" {...iconProps}>
          <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" />
          <circle cx="10" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
        </svg>
      ),
    },
    {
      href: '/cuenta/saldo',
      label: 'Añadir saldo',
      matches: (path) => path.startsWith('/cuenta/saldo'),
      icon: (
        <svg viewBox="0 0 24 24" {...iconProps}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 10h19" />
          <path d="M6 15h4" />
        </svg>
      ),
    },
    {
      href: '/cuenta',
      label: 'Cuenta',
      matches: (path) =>
        (path.startsWith('/cuenta') && !path.startsWith('/cuenta/pedidos')) ||
        path.startsWith('/login') ||
        path.startsWith('/registro'),
      icon: (
        <svg viewBox="0 0 24 24" {...iconProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6" />
        </svg>
      ),
    },
    {
      href: '/extra',
      label: 'EXTRA',
      matches: (path) => path.startsWith('/extra'),
      icon: (
        <svg viewBox="0 0 24 24" {...iconProps}>
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
          <path d="M17.25 13.5v7.5M13.5 17.25h7.5" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="ns-nav" aria-label="Navegación principal">
      <ul className="ns-nav-list">
        {items.map((item) => {
          const active = item.matches(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`ns-nav-link ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="ns-nav-ico">
                  {item.icon}
                  {item.href === '/carrito' ? (
                    <span className="ns-nav-badge">{cartCount > 99 ? '99+' : cartCount}</span>
                  ) : null}
                </span>
                <span className="ns-nav-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
