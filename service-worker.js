const CACHE_NAME = 'parquinho-cache-v1';
const FILES_TO_CACHE = [
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

// instala
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// ativa
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })
    ))
  );
  self.clients.claim();
});

// fetch: serve do cache, fallback para network
self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    caches.match(evt.request).then(resp => resp || fetch(evt.request).then(netResp => {
      // opcional: cachear recursos dinâmicos
      return caches.open(CACHE_NAME).then(cache => {
        try { cache.put(evt.request, netResp.clone()); } catch(e){}
        return netResp;
      });
    })).catch(()=> caches.match('./index.html'))
  );
});
