const CACHE = 'pya-jalpan-v2';

// Pre-cache shell pages so navegación funciona offline
const SHELL = ['/', '/pisos', '/banos', '/complementos', '/inventario', '/calculadora'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // No cachear llamadas a Supabase (datos en tiempo real)
  if (url.hostname.includes('supabase')) return;

  // No cachear payloads internos de Next.js (RSC / route data): cambian en
  // cada deploy y servir versiones viejas rompe la hidratación de React
  if (
    url.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-Prefetch')
  ) return;

  // Imágenes del bucket: cache-first (raramente cambian)
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  // Páginas de navegación: network-first con fallback al cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((hit) => hit || caches.match('/'))
      )
    );
    return;
  }

  // Assets estáticos (JS, CSS, fuentes): stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      const fresh = fetch(event.request).then((res) => {
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      });
      return hit || fresh;
    })
  );
});
