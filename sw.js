const CACHE_NAME = 'name-match-v1';
const ASSETS = [
  '/name-match/',
  '/name-match/index.html',
  '/name-match/css/style.css',
  '/name-match/js/app.js',
  '/name-match/js/i18n.js',
  '/name-match/js/locales/ko.json',
  '/name-match/js/locales/en.json',
  '/name-match/js/locales/ja.json',
  '/name-match/js/locales/zh.json',
  '/name-match/js/locales/hi.json',
  '/name-match/js/locales/ru.json',
  '/name-match/js/locales/es.json',
  '/name-match/js/locales/pt.json',
  '/name-match/js/locales/id.json',
  '/name-match/js/locales/tr.json',
  '/name-match/js/locales/de.json',
  '/name-match/js/locales/fr.json',
  '/name-match/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetched = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
