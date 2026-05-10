/* eslint-disable linebreak-style */
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js',
);

if (workbox) {
  console.log('Workbox berhasil dimuat');

  workbox.precaching.precacheAndRoute([
    { url: '/', revision: '2' },
    { url: '/index.html', revision: '2' },
    { url: '/manifest.json', revision: '2' },
    { url: '/model/metadata.json', revision: '2' }
  ]);

  workbox.routing.registerRoute(
    ({ url }) =>
      url.origin === 'https://cdn.jsdelivr.net' ||
      url.origin === 'https://huggingface.co',
    new workbox.strategies.CacheFirst({
      cacheName: 'ai-models-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    }),
  );

  // Default caching untuk aset JS, CSS, dll
  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    }),
  );
} else {
  console.log('Workbox gagal dimuat');
}
