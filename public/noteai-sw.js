const SHELL_CACHE = "noteai-shell-v2";
const PUBLIC_ASSET_PATHS = new Set(["/noteai-sw.js"]);

function isAllowedShellUrl(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname === "/" ||
      url.pathname.startsWith("/_next/static/") ||
      PUBLIC_ASSET_PATHS.has(url.pathname))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names
              .filter((name) => name.startsWith("noteai-shell-") && name !== SHELL_CACHE)
              .map((name) => caches.delete(name)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    !isAllowedShellUrl(url)
  ) {
    return;
  }

  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match("/");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        }),
    ),
  );
});
