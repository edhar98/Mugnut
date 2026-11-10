// Mugnut service worker: makes the game work offline.
// BUILD is a hash of the cached files, written by tools/stamp.js (run by the pre-commit hook). Never edit it by hand.
const BUILD = "89fea83a2b";
const CACHE = "mugnut-" + BUILD;
const FILES = ["./", "index.html", "objects.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  // cache:"reload" skips the browser's HTTP cache, so a new build never stores a file fetched before the deploy
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first for the page (so updates arrive), cache first for everything else.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    // only a good copy of the game's own page is kept for offline use (not a 404 for a mistyped address)
    const isApp = new URL(req.url).pathname.replace(/index\.html$/, "") === new URL("./", location).pathname;
    e.respondWith(fetch(req).then(r => { if(r.ok && isApp){ const copy = r.clone(); caches.open(CACHE).then(c => c.put("index.html", copy)); } return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
