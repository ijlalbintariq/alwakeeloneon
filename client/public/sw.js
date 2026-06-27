const CACHE_NAME = "al-wakeelo-v4";
const STATIC_ASSETS = [
  "/",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
  "/logo.svg",
];

function isAllowedHost() {
  const host = (self.location && self.location.hostname ? String(self.location.hostname) : "").toLowerCase();
  return host === "alwakeelo.com" || host === "www.alwakeelo.com" || host === "alwakeeloneon-1.onrender.com";
}

self.addEventListener("install", (event) => {
  if (!isAllowedHost()) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (!isAllowedHost()) {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
        await self.registration.unregister();
      })()
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (!isAllowedHost()) return;

  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) return;

  // Let all third-party/cross-origin requests bypass the Service Worker completely
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
