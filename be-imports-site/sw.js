const cacheName = 'be-imports-static-v38';
const assetCacheName = 'be-imports-assets-v38';
const offlinePage = '/offline.html';
const staticShell = [
  offlinePage,
  '/styles.css?v=35',
  '/perfumes-page.css?v=1',
  '/eletronicos-page.css?v=2',
  '/hero-polish.css?v=3',
  '/pwa-responsive.css?v=6',
  '/script.js?v=47',
  '/pwa.js?v=1',
  '/perfumes-page.js?v=1',
  '/eletronicos-page.js?v=2',
  '/catalog-filter.js?v=7',
  '/bermudas-page.js?v=3',
  '/ofertas-page.js?v=2',
  '/manifest.webmanifest',
  '/assets/logo-original.webp',
  '/assets/pwa-192.png',
  '/assets/pwa-512.png',
  '/assets/pwa-maskable-512.png',
  '/assets/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(staticShell)));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => (key.startsWith('be-imports-shell-') || key.startsWith('be-imports-static-') || key.startsWith('be-imports-assets-')) && ![cacheName, assetCacheName].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/uploads/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(offlinePage)) || Response.error()));
    return;
  }

  if (!/\.(?:css|js|png|webp|jpe?g|ico|webmanifest)$/.test(url.pathname)) return;
  event.respondWith(caches.match(request).then(async cached => {
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(assetCacheName);
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > 60) await cache.delete(keys[0]);
    }
    return response;
  }));
});
