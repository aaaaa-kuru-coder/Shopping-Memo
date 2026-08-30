
const CACHE_NAME = "shopping-memo-v5";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./items.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // items.json: prefer the latest GitHub Pages version while online.
  if (url.pathname.endsWith("/items.json")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, copy)
            );
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Product icons can be added later without editing the service-worker list.
  if (url.pathname.includes("/images/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(event.request, copy)
              );
            }
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) =>
          cache.put(event.request, copy)
        );
        return response;
      });
    }).catch(() => caches.match("./index.html"))
  );
});
