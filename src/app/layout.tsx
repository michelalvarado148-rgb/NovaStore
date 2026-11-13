import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { getSettings } from '@/lib/catalog';
import { getCartCount } from '@/lib/cart';

export const metadata: Metadata = {
  title: {
    default: 'NOVASTORE · Productos digitales al instante',
    template: '%s · NOVASTORE',
  },
  description:
    'NOVASTORE es tu tienda de productos digitales en Perú: gift cards, streaming, aplicaciones, redes sociales y números virtuales. Paga en soles con Yape, Plin o tarjeta.',
  keywords: [
    'NOVASTORE',
    'productos digitales',
    'gift cards',
    'streaming',
    'Perú',
    'Yape',
    'Plin',
  ],
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings();
  const cartCount = await getCartCount();
  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen flex-col pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:pb-24">
          <Header storeName={settings.store_name || 'NOVASTORE'} telegramUrl={settings.telegram_url} />
          <main className="flex-1">{children}</main>
          <Footer settings={settings} />
        </div>
        <BottomNav cartCount={cartCount} />
      </body>
    </html>
  );
}
