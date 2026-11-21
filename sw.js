// Keeps the app shell cached so it still opens on bad Wi-Fi. Spotify calls always go to the network.
// Bump VERSION with every release (it must match APP_VERSION in app.js).
const VERSION = "12";
const CACHE = "rinkmusic-v" + VERSION;
const SHELL = ["./", "index.html", "app.js", "songs.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "logo.png", "fonts/oswald-latin-600-normal.woff2", "fonts/oswald-latin-700-normal.woff2"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;
  if (url.search.includes("code=")) return; // Spotify login redirect: never serve from cache
  // Network first, and skip the browser's HTTP cache (GitHub Pages lets it keep files for
  // 10 minutes), so a new version shows up the next time the app opens. Cache is the fallback.
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
