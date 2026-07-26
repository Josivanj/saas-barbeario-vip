const CACHE_NAME = "barbearia-vip-v9";
const PUBLIC_SHELL = [
  "/", "/index.html", "/agendar.html", "/login.html", "/confirmar.html",
  "/manifest.webmanifest", "/admin-manifest.webmanifest", "/css/style.css", "/css/agendar.css", "/css/login.css",
  "/js/script.js", "/js/site-data.js", "/js/agendar.js", "/js/login.js",
  "/js/supabase-config.js", "/js/pwa.js",
  "/assets/app-icon-192.png", "/assets/app-icon-512.png", "/assets/hero-barber-v2.webp"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PUBLIC_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Painel e navegações usam a rede primeiro para nunca exibir agenda antiga.
  if (request.mode === "navigate" || url.pathname.includes("admin")) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok && !url.pathname.includes("admin")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(url.pathname).then(cached => cached || caches.match("/index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/admin.html"));
});
