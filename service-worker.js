const OFFLINE_VERSION = '0.0.29';
const cacheName = `my-checkin-v${OFFLINE_VERSION}`;
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(cacheName).then(function(cache) {
      return cache.addAll([
          '/',
          '/index.html',
          '/favicon.ico',
          '/manifest.json',
          '/css/app.css',
          '/js/app.js',
          '/js/qrcode-read.min.js',
          '/js/qrcode-write.min.js',
          '/img/business.png',
          '/img/user.png',
          '/pwa/img/icon-192v2.png',
          '/pwa/img/icon-512v2.png',
          ]).then(() => self.skipWaiting(), e => console.warn(e));
    })
  );
});

self.addEventListener('activate', function(event) {
  var cacheKeeplist = [cacheName];
  event.waitUntil(
      caches.keys().then((keyList) => {
        return Promise.all(keyList.map( (key) => {
                if (cacheKeeplist.indexOf(key) === -1) {
                    return caches.delete(key);
                }
            }));
        })
  .then(self.clients.claim()));

});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.open(cacheName)
      .then(cache => cache.match(event.request, {ignoreSearch: true}))
      .then(response => {
        console.info(response);
        return (response || fetch(event.request));
      })
  );
});