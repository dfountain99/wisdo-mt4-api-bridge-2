const CACHE_NAME = 'wisdo-shell-v6.1.0-full-queue-audit';
const SHELL = [
  '/', '/pricing', '/copier', '/analyzer', '/compare', '/academy',
  '/js/workspace.js', '/js/wisdo-assistant.js', '/js/df-sauce-academy.js', '/media/wisdo-og.svg', '/platforms/mt4.svg',
  '/platforms/mt5.svg', '/platforms/ctrader.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Never intercept or cache large video/range traffic. Decorative media must not
  // compete with account APIs, scripts, or service-worker storage.
  if (url.pathname.endsWith('.mp4') || request.headers.has('range')) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || caches.match('/'))));
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
