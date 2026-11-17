// Keeps the app shell cached so it opens instantly. Spotify calls always go to the network.
const CACHE = "rinkmusic-v7";
const SHELL = ["./", "index.html", "app.js", "songs.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "logo.png", "fonts/oswald-latin-600-normal.woff2", "fonts/oswald-latin-700-normal.woff2"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;
  if (url.search.includes("code=")) return; // Spotify login redirect: never serve from cache
  // network first (so updates show up), cache as fallback
  e.respondWith(
    fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
