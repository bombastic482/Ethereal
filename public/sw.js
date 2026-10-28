/* Ethereal service worker: offline-first for hashed assets, network-first for pages. */
const VERSION = 'v5';
const ASSET_CACHE = `ethereal-assets-${VERSION}`;
const PAGE_CACHE = `ethereal-pages-${VERSION}`;
const scopePath = new URL(self.registration.scope).pathname; // "/" or "/Ethereal/"
const OFFLINE_URL = `${scopePath}offline/`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) =>
        cache
          .addAll([
            OFFLINE_URL,
            scopePath,
            ...['today/', 'plan/', 'track/', 'review/', 'settings/', 'recipes/', 'eating-out/'].map(
              (p) => `${scopePath}${p}`,
            ),
          ])
          .catch(() => undefined),
      )
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

/** Keeps a cache to its newest `max` entries (insertion order is oldest first). */
async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

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
        if (res.ok) {
          await cache.put(request, res.clone());
          trim(cache, 160); // old deploys' hashed files would otherwise pile up forever
        }
        return res;
      }),
    );
    return;
  }

  // HTML pages: network-first, fall back to cache, then the offline page. Astro's client
  // router fetches pages with a plain fetch (not mode "navigate"), so detect HTML by the
  // Accept header too; otherwise soft navigations would get stale cached pages forever.
  const wantsHtml =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') ?? '').includes('text/html') ||
    // The client router sends no Accept header; on this static site a same-origin GET
    // whose path has no file extension is always a page.
    !/\.[a-z0-9]+$/i.test(url.pathname);
  if (wantsHtml) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Cache only good, final responses; a cached 404 or redirect would be served offline.
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
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
        .catch(() => hit ?? Response.error());
      return hit ?? network;
    }),
  );
});
