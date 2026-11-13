import type { MetadataRoute } from 'next';

/**
 * Manifest PWA de NOVASTORE.
 *
 * En Android, Chrome permite recibir push con la pestaña cerrada en cuanto se
 * concede el permiso. En iPhone/iPad (iOS 16.4 o superior) Apple solo entrega
 * push a la tienda instalada: por eso el manifest y los iconos son necesarios.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NOVASTORE · Tienda de productos digitales',
    short_name: 'NOVASTORE',
    description:
      'NOVASTORE es tu tienda de productos digitales en Perú: streaming, juegos, aplicaciones, redes sociales y números virtuales.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#07040f',
    theme_color: '#0b0714',
    lang: 'es',
    categories: ['shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
