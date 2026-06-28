// UCL Immortals — minimal service worker.
// Purpose: make the app installable (PWA) and give the app shell a basic offline fallback.
// Deliberately conservative: it only ever touches same-origin GET navigations (the HTML shell),
// always trying the NETWORK FIRST so online users get fresh, hashed assets. Everything else —
// API calls, socket.io/websockets, cross-origin fonts/images — is left completely untouched.
const CACHE = 'ucl-shell-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop old shell caches from previous versions.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle top-level page navigations (the HTML shell). Leave assets/API/ws alone.
  const isNavigation = req.mode === 'navigate' && req.method === 'GET';
  if (!isNavigation) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put('/', fresh.clone()); // keep the latest shell for offline
      return fresh;
    } catch {
      // Offline → serve the last cached shell, if any.
      const cached = await caches.match('/');
      return cached ?? Response.error();
    }
  })());
});
