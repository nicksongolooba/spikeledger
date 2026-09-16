/* SpikeLedger service worker.
 * - App shell + static assets: cache-first (immutable hashed Next chunks).
 * - Page navigations (incl. the courtside /match/[id]/entry page): network-first
 *   with a cache fallback, so visited pages load offline. Actual offline stat
 *   recording is handled separately by the entry page's write-ahead log.
 * - API calls are never cached (always network).
 */
const VERSION = "v5"; // new icon files (-v4 names): disc only on desktop, inset plate on iOS
const STATIC_CACHE = `spikeledger-static-${VERSION}`;
const PAGE_CACHE = `spikeledger-pages-${VERSION}`;

// Minimal precache: the offline fallback + brand art. Hashed JS/CSS is cached
// at runtime as it's requested (their URLs change per build).
const PRECACHE = [
  "/offline.html",
  "/manifest.json",
  "/logo-full@2x.png",
  "/logo-full-on-dark@2x.png",
  "/logo-icon.png",
  "/icons/icon-192-v4.png",
  "/icons/icon-512-v4.png",
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

// ---------------------------------------------------------------------------
// Match-start alerts (web push). Payload shape: src/lib/push.ts PushMessage.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "SpikeLedger";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192-v4.png",
      // Same tag = the same match; a repeat replaces instead of stacking.
      tag: data.tag || undefined,
      data: { url: data.url || "/parent" },
    }),
  );
});

// Tap: go straight to the player's live view. Reuse an open SpikeLedger
// window when there is one, otherwise open the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/parent";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const exact = windows.find((c) => c.url === target);
      if (exact) return exact.focus();
      const app = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (app && "navigate" in app) {
        await app.focus();
        return app.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});

// The browser rotated the subscription (Firefox does this; others rarely).
// Subscribe again with the same options and tell the server.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription && event.oldSubscription.options;
      const sub = event.newSubscription || (options ? await self.registration.pushManager.subscribe(options) : null);
      if (!sub) return;
      await fetch("/api/push/subscriptions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sub.toJSON(),
          renewed: true,
          replaces: event.oldSubscription ? event.oldSubscription.endpoint : undefined,
        }),
      });
    })().catch(() => undefined),
  );
});
