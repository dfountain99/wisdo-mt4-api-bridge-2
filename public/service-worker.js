const CACHE_NAME = 'wisdo-static-v7.0.5-heap-transport';
const STATIC_ASSETS = [
  '/js/workspace.js',
  '/js/wisdo-recognition.js',
  '/js/wisdo-assistant.js',
  '/js/df-sauce-academy.js',
  '/media/wisdo-og.svg',
  '/platforms/mt4.svg',
  '/platforms/mt5.svg',
  '/platforms/ctrader.svg'
];

function isCacheableStatic(url, request) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) return false;
  if (request.headers.has('range') || url.pathname.endsWith('.mp4')) return false;
  return url.pathname.startsWith('/js/') || url.pathname.startsWith('/media/') || url.pathname.startsWith('/platforms/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // API, MT4, app/member/admin HTML, navigations, and the service worker itself are
  // always network-owned. A stale shell must never answer a trading bridge request.
  if (!isCacheableStatic(url, request) || url.pathname === '/service-worker.js') return;
  event.respondWith(caches.match(request).then((cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
      }
      return response;
    });
    return cached || network;
  }));
});

self.addEventListener('push', (event) => {
  let payload = { title: 'WISDO', body: 'You have a new trading-system alert.', url: '/app/alerts' };
  try { payload = { ...payload, ...(event.data?.json() || {}) }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/media/logo_transparent_background.png',
    badge: '/media/logo_transparent_background.png',
    data: { url: payload.url || '/app/alerts' },
    tag: payload.tag || 'wisdo-alert'
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/app/alerts';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
