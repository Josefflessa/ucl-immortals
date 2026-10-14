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

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  if (!data || typeof data !== 'object') data = {};

  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.slice(0, 100)
    : 'UCL Immortals';
  const body = typeof data.body === 'string' ? data.body.slice(0, 240) : '';
  const url = typeof data.url === 'string' ? data.url : '/';
  const tag = typeof data.tag === 'string' ? data.tag.slice(0, 100) : 'ucl-notification';

  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag,
      data: { url },
    });
    if (tag.startsWith('friend-message:')) {
      const friendshipId = tag.slice('friend-message:'.length);
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((client) => {
        if (new URL(client.url).origin === self.location.origin) {
          client.postMessage({ type: 'friend-message-received', friendshipId });
        }
      });
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    let target = new URL('/', self.location.origin);
    try {
      const candidate = new URL(event.notification.data?.url || '/', self.location.origin);
      if (candidate.origin === self.location.origin) target = candidate;
    } catch {
      // Keep the safe home destination.
    }

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try {
        if (event.notification.tag.startsWith('room-invitation:')) {
          client.postMessage({ type: 'room-invitation' });
          await client.focus();
          return;
        }
        if (event.notification.tag.startsWith('friend-message:')) {
          client.postMessage({
            type: 'friend-message',
            friendshipId: event.notification.tag.slice('friend-message:'.length),
          });
          await client.focus();
          return;
        }
        await client.navigate(target.href);
        await client.focus();
        return;
      } catch {
        // Try another app window before opening a fresh one.
      }
    }
    await self.clients.openWindow(target.href);
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
