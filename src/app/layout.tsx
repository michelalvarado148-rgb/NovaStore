import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getSettings } from '@/lib/catalog';

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
  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen flex-col">
          <Header storeName={settings.store_name || 'NOVASTORE'} telegramUrl={settings.telegram_url} />
          <main className="flex-1">{children}</main>
          <Footer settings={settings} />
        </div>
      </body>
    </html>
  );
}
