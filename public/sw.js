// Offline support: cache-first for the hashed build assets, network-first for the page itself
// (so a new deploy shows up on the next online visit).
const CACHE = 'wztd-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg',
    ...['grass', 'drygrass', 'patchy', 'sand', 'gravel', 'mud', 'rock', 'snow'].map((n) => `./terrain/${n}.jpg`)])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(
    isPage
      ? fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        }).catch(() => caches.match('./'))
      : caches.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })),
  );
});
