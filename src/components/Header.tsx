import Link from 'next/link';
import { getCartCount } from '@/lib/cart';
import { getCategories } from '@/lib/catalog';
import { getCurrentUser } from '@/lib/auth';
import HeaderBar from '@/components/header/HeaderBar';
import { logoutAction } from '@/app/actions/session';

type HeaderProps = {
  storeName: string;
  telegramUrl?: string;
};

export default async function Header({ storeName, telegramUrl }: HeaderProps) {
  const [user, cartCount] = await Promise.all([
    getCurrentUser().catch(() => null),
    getCartCount().catch(() => 0),
  ]);

  const categories = getCategories()
    .slice(0, 8)
    .map((category) => ({ id: category.id, name: category.name, slug: category.slug }));

  return (
    <HeaderBar
      storeName={storeName}
      telegramUrl={telegramUrl}
      cartCount={cartCount}
      categories={categories}
      user={user ? { name: user.name, role: user.role } : null}
      logoutSlot={
        user ? (
          <form action={logoutAction}>
            <button type="submit" className="ns-drawer-logout">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4H5v16h10M10 12h11M18 8l3 4-3 4" />
              </svg>
              Cerrar sesión
            </button>
          </form>
        ) : null
      }
    />
  );
}
