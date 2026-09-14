/* SpikeLedger service worker.
 * - App shell + static assets: cache-first (immutable hashed Next chunks).
 * - Page navigations (incl. the courtside /match/[id]/entry page): network-first
 *   with a cache fallback, so visited pages load offline. Actual offline stat
 *   recording is handled separately by the entry page's write-ahead log.
 * - API calls are never cached (always network).
 */
const VERSION = "v2"; // bumped with the 2026-09 logo change so the old brand art leaves the cache
const STATIC_CACHE = `spikeledger-static-${VERSION}`;
const PAGE_CACHE = `spikeledger-pages-${VERSION}`;

// Minimal precache: the offline fallback + brand art. Hashed JS/CSS is cached
// at runtime as it's requested (their URLs change per build).
const PRECACHE = [
  "/offline.html",
  "/manifest.json",
  "/logo-full.png",
  "/logo-full-on-dark.png",
  "/logo-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Let the page tell a waiting SW to take over immediately.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/splash/") ||
    /\.(?:css|js|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // third-party: passthrough
  if (url.pathname.startsWith("/api/")) return; // never cache API/auth

  // Page navigations: network-first, fall back to cache, then offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline.html");
        }),
    );
    return;
  }

  // Static assets: cache-first with background refresh (stale-while-revalidate).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
