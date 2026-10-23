const CACHE_NAME = "safari-csd-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192.svg",
  "/icon-512.svg"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Some static assets failed to precache:", err);
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. STRICTLY BYPASS all dynamic backend API and operational routes
  // These must always hit the network or the application's offline sync queue
  const isApiRoute =
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/employees") ||
    url.pathname.startsWith("/locations") ||
    url.pathname.startsWith("/sales") ||
    url.pathname.startsWith("/transfers") ||
    url.pathname.startsWith("/products") ||
    url.pathname.startsWith("/damages") ||
    url.pathname.startsWith("/reconciliation") ||
    url.pathname.startsWith("/admin");

  if (event.request.method !== "GET" || isApiRoute) {
    return;
  }

  // 2. Navigation request (SPA HTML page routing) -> Network first, fallback to cached index.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedIndex = await caches.match("/index.html");
        return (
          cachedIndex ||
          new Response("Safari CSD Offline Mode", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          })
        );
      })
    );
    return;
  }

  // 3. Static assets (JS, CSS, SVGs, PNGs) -> Cache first with network fallback
  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          const toCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, toCache);
          });
        }
        return networkResponse;
      } catch (err) {
        // Fallback response prevents "TypeError: Failed to convert value to Response"
        return new Response("Offline asset unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      }
    })
  );
});
