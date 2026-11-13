/* Service worker de NOVASTORE: recibe los push del administrador y abre la
 * sección correspondiente al tocar la notificación. */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { title: 'NOVASTORE', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'NOVASTORE';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.tag || data.kind || 'novastore',
    renotify: false,
    requireInteraction: false,
    vibrate: [90, 40, 90],
    data: { url: data.url || '/admin' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.url || '/admin';

  event.waitUntil(
    (async () => {
      const absolute = new URL(target, self.location.origin).href;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url === absolute) {
          await client.focus();
          return;
        }
      }
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(absolute);
              return;
            } catch (error) {
              /* si no se puede navegar, se abre una ventana nueva */
            }
          }
        }
      }
      await self.clients.openWindow(absolute);
    })(),
  );
});

/* Si el navegador renueva la suscripción, se avisa a la página abierta para
 * que el administrador pueda reactivarla desde el panel. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        client.postMessage({ type: 'novastore:push-subscription-change' });
      }
    }),
  );
});
