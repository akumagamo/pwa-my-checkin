
// ..... chrome://serviceworker-internals/

const OFFLINE_VERSION = '0.1.0';
const FETCH_CACHE_NAME = `my-checkin-v${OFFLINE_VERSION}`;

self.addEventListener('install', function(event) {
  console.info('INSTALL', OFFLINE_VERSION, event);
  shouldShowStartScreen = true;
  self.skipWaiting();
  event.waitUntil(
    caches.open(FETCH_CACHE_NAME).then(function(cache) {
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
  console.info('ACTIVATE', OFFLINE_VERSION, event);
  var cacheKeeplist = [FETCH_CACHE_NAME];
  event.waitUntil(
      caches.keys().then((keyList) => {
        return Promise.all(keyList.map( (key) => {
                if (cacheKeeplist.indexOf(key) === -1) {
                    return caches.delete(key);
                }
            }));
        })
  .then(self.clients.claim()));

  self.clients.matchAll().then(function(foundClients) {
    for (var idx = 0 ; idx < foundClients.length ; idx++) {
      foundClients[idx].postMessage({version:OFFLINE_VERSION});
    }
  });
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.open(FETCH_CACHE_NAME)
      .then(cache => cache.match(event.request, {ignoreSearch: true}))
      .then(response => {
        return (response || fetch(event.request));
      })
  );
});