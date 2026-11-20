const CACHE_NAME = 'goplan-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './assets/plani-logo-96.png',
  './assets/plani-logo-192.png',
  './assets/plani-logo-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('goplan-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
    return response;
  })));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : '' }; }
  const title = String(payload.title || 'GoPlan').slice(0, 80);
  const options = {
    body: String(payload.body || 'GoPlanからお知らせがあります。').slice(0, 240),
    icon: './icon-192.png',
    badge: './favicon.png',
    tag: payload.tag ? String(payload.tag).slice(0, 100) : undefined,
    renotify: false,
    data: { url: payload.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const appBase = new URL('./', self.location.href);
    const requested = new URL(String(event.notification.data && event.notification.data.url || './'), appBase);
    const target = requested.origin === appBase.origin && requested.pathname.startsWith(appBase.pathname)
      ? requested.href
      : appBase.href;
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin === appBase.origin && clientUrl.pathname.startsWith(appBase.pathname)) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
