// offline shell for the operator app: cache the app files, let API calls fail fast so the page queues them
const C = 'dyn-op-v1', FILES = ['/erp/op.html', '/erp/erp.css', '/erp/erp.js', '/erp/manifest.webmanifest', '/erp/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { const u = new URL(e.request.url); if (u.pathname.startsWith('/api/')) return; e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => { const cp = x.clone(); caches.open(C).then(c => c.put(e.request, cp)); return x; }).catch(() => caches.match('/erp/op.html')))); });
