// Ubuntu Daycare OS — service worker (update-safe).
// HTML/navigation is NETWORK-FIRST so a new deploy is picked up on the next load
// (no hard refresh needed); content-hashed /assets/* are cache-first (immutable);
// API is network-first with an offline fallback. Bump VERSION on any change here.
const VERSION = 'v2';
const STATIC_CACHE = `udos-static-${VERSION}`;
const API_CACHE = `udos-api-${VERSION}`;

const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon-192.svg', '/icons/icon-512.svg'];

// Install — pre-cache the shell and take over immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

// Activate — drop every cache that isn't the current version, then claim clients.
self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Let the page force an immediate takeover if it wants.
self.addEventListener('message', (event) => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // API — network-first (fresh data; cache is only an offline fallback).
  if (url.pathname.startsWith('/api/')) { event.respondWith(networkFirst(request, API_CACHE)); return; }

  // Content-hashed static assets — cache-first (filenames change on each build).
  if (url.pathname.includes('/assets/') || /\.(?:js|css|svg|png|jpg|jpeg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigations / HTML — NETWORK-FIRST so new deploys are seen without a hard refresh.
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstDoc(request));
    return;
  }

  event.respondWith(networkFirst(request, STATIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch { return new Response('Offline', { status: 503 }); }
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ ok: false, error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

// HTML: always try the network first; fall back to the cached shell when offline.
async function networkFirstDoc(request) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(STATIC_CACHE)).put('/index.html', res.clone());
    return res;
  } catch {
    return (await caches.match(request)) || (await caches.match('/index.html')) || (await caches.match('/')) || new Response('Offline', { status: 503 });
  }
}
