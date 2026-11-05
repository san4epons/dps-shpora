/* Шпаргалка: работа без интернета.
   Страницы — сначала из сети (всегда свежая версия), без сети — сохранённая копия.
   Шрифты и иконки — из кэша, в фоне обновляются. */
const CACHE = "shpora-v1";
const PAGES = ["./", "index.html", "govorit.html", "ustav.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PAGES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("shpora-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isPage = req => req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !fonts) return;

  if (same && isPage(req)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: "no-cache" });
        if (res.ok) cache.put(url.pathname.endsWith("/") ? "./" : req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true }))
          || (await cache.match(url.pathname.endsWith("/") ? "./" : "index.html"))
          || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: same });
    const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});
