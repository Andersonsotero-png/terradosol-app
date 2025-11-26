const CACHE_NAME = 'parquinho-v1';
const PRECACHE_URLS = ['/', 'index.html', 'css/style.css', 'js/script.js', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(resp => resp || fetch(event.request)));
});
