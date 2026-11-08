/* Лад PWA — без offline-черги й без кешу приватних сторінок/API. */
const SHELL_CACHE = "lad-shell-v1";
const SHELL_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

function isPrivatePath(pathname) {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname === "/login" ||
    pathname === "/forgot-password"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isPrivatePath(url.pathname) || req.mode === "navigate") {
    event.respondWith(fetch(req));
    return;
  }

  // Лише статичні іконки/manifest — cache-first; HTML/app ніколи.
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/favicon.png"
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_PRIVATE") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        );
      })(),
    );
  }
});
