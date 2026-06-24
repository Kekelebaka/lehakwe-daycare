/* Lehakwe Daycare Manager — Service Worker v1 */
const CACHE = 'lehakwe-v1';
const SHELL = ['/', '/index.html'];

/* Install: pre-cache the app shell */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* Activate: remove old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Fetch: strategy by request type */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* API calls — network first, offline JSON fallback */
  if (url.pathname.startsWith('/api')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          /* Cache successful GET responses */
          if (e.request.method === 'GET' && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          /* Try stale cache for GET, else offline error */
          if (e.request.method === 'GET') {
            const cached = await caches.match(e.request);
            if (cached) return cached;
          }
          return new Response(
            JSON.stringify({ ok: false, error: 'You are offline. Please reconnect to send or receive messages.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  /* Navigation — serve app shell, fallback to cache */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  /* Static assets — cache first */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
