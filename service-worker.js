const CACHE_NAME = "jm-guinchos-v7-login-flow";
const ASSETS = [
  "./",
  "./index.html",
  "./jm.html",
  "./motorista.html",
  "./superadmin.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.firebase.js",
  "./js/utils.js",
  "./js/firebase.js",
  "./js/tracker.js",
  "./js/mapa.js",
  "./js/app.js",
  "./js/motorista.js",
  "./js/superadmin.js",
  "./assets/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/js/config.firebase.js")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("./index.html"));
    })
  );
});
