/* Ethereal service worker: offline-first for hashed assets, network-first for pages. */
const VERSION = 'v1';
const ASSET_CACHE = `ethereal-assets-${VERSION}`;
const PAGE_CACHE = `ethereal-pages-${VERSION}`;
const scopePath = new URL(self.registration.scope).pathname; // "/" or "/Ethereal/"
const OFFLINE_URL = `${scopePath}offline/`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, scopePath]).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('ethereal-') && !k.endsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build assets and fonts: cache-first, they never change under the same name.
  if (url.pathname.includes('/_astro/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // HTML navigations: network-first, fall back to cache, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(
          async () =>
            (await caches.match(request)) ?? (await caches.match(OFFLINE_URL)) ?? Response.error(),
        ),
    );
    return;
  }

  // Everything else (icons, manifest, images): stale-while-revalidate.
  event.respondWith(
    caches.open(PAGE_CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit ?? network;
    }),
  );
});
