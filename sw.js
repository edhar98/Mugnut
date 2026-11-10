// Mugnut service worker: makes the game work offline.
// BUILD is a hash of the cached files, written by tools/stamp.js (run by the pre-commit hook). Never edit it by hand.
const BUILD = "fd25b432c4";
const CACHE = "mugnut-" + BUILD;
const FILES = ["./", "index.html", "objects.js", "native.js", "manifest.webmanifest",
  "packs/kitchen.js", "packs/clothing.js", "packs/tools.js", "packs/letters.js", "packs/controversies.js",
  "lang/hy.js", "lang/ru.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  // cache:"reload" skips the browser's HTTP cache, so a new build never stores a file fetched before the deploy
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// The game is one page plus several script files that must match it, so the page and every script are fetched from the
// network first (an update then arrives whole, never a new page with old scripts) and each good response refreshes the
// cache, which is what is served offline. Only images, which never change meaning between versions, are cache first.
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const keep = (key, r) => { if (r.ok) { const copy = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(key, copy))); } return r; };
  if (req.mode === "navigate") {
    // only a good copy of the game's own page is kept for offline use (not a 404 for a mistyped address)
    const isApp = url.pathname.replace(/index\.html$/, "") === new URL("./", location).pathname;
    e.respondWith(fetch(req).then(r => isApp ? keep("index.html", r) : r).catch(() => caches.match("index.html")));
    return;
  }
  if (/\.png$/.test(url.pathname)) { e.respondWith(caches.match(req).then(hit => hit || fetch(req))); return; }
  // scripts, the manifest: only files this version knows are stored
  const known = FILES.some(f => new URL(f, location).pathname === url.pathname);
  e.respondWith(fetch(req).then(r => known ? keep(req, r) : r).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || Response.error())));
});
