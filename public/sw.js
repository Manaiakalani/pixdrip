const CACHE_NAME = 'pixdrip-v4';
const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
];

// Install — precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Allow the page to trigger an immediate activation of a new SW.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper: cache-first with background population
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200 && response.type !== 'opaque') {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
  }
  return response;
}

// Helper: stale-while-revalidate (serves cache, refreshes in background)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || cache.match('/');
}

// Fetch — strategy depends on resource type
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation / index.html — stale-while-revalidate so users get fast loads
  // but pick up the latest HTML on next visit.
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(staleWhileRevalidate(new Request('/', { credentials: 'same-origin' })));
    return;
  }

  // Hashed Vite build assets — cache-first (filenames are content-addressed,
  // so they're effectively immutable).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Self-hosted woff2 fonts — cache-first (rarely change).
  if (url.pathname.startsWith('/fonts/') && url.pathname.endsWith('.woff2')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else — cache-first with network fallback.
  event.respondWith(cacheFirst(request));
});
