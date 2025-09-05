const CACHE_NAME = "calfast-v4-cache-v1";
const toCache = ["index.html","style.css","app.js","foods.json","manifest.json","icons/icon-192.png","icons/icon-512.png"];

self.addEventListener("install", (evt)=>{
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(toCache))
  );
});

self.addEventListener("activate", (evt)=>{
  evt.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (evt)=>{
  evt.respondWith(caches.match(evt.request).then(resp=>resp || fetch(evt.request)));
});