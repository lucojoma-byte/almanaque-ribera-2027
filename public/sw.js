const base = self.registration.scope;
const prefix = "ribera-" + new URL(base).pathname + "-";
const version = prefix + "ca0e850900e33234b474";
const assets = ["app.js", "assets/icon-192.png", "assets/icon-512.png", "assets/qr-suscripcion.svg", "assets/ribera.svg", "assets/sello.svg", "cuaderno.css", "cuaderno.js", "data/cielo.json", "data/fechas-clima.json", "data/siembra.json", "index.html", "manifest.webmanifest", "naturaleza.js", "privacidad.html", "reglas.html", "styles.css"].map(path => new URL(path, base).href);
self.addEventListener("install", event => {
  event.waitUntil(caches.open(version).then(cache =>
    cache.addAll(assets.map(url => new Request(url, {cache: "reload"})))
  ).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== version) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(base)) return;
  const page = new URL(url.pathname, url.origin).href;
  const key = event.request.mode === "navigate"
    ? (page === base ? new URL("index.html", base).href : page)
    : url.href;
  if (!assets.includes(key)) return;
  event.respondWith(caches.open(version).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
