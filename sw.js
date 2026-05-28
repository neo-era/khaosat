// sw.js — Service Worker đơn giản: precache shell + stale-while-revalidate cho assets.
// Network only cho Apps Script + Cloudinary (đừng cache API response).

const CACHE_NAME = 'khaosat-v1';

const SHELL = [
  './',
  './index.html',
  './login.html',
  './form.html',
  './recent.html',
  './kpi.html',
  './my-kpi.html',
  './manage.html',
  './report.html',
  './map.html',
  './users.html',
  './docs.html',
  './schedule.html',
  './manifest.json',
  './js/config.js',
  './js/utils.js',
  './js/storage.js',
  './js/auth.js',
  './js/api.js',
  './js/gps.js',
  './js/camera.js',
  './js/lookups.js',
  './js/schemas.js',
  './js/form-renderer.js',
  './js/kpi.js',
  './js/my-kpi.js',
  './js/manage.js',
  './js/report.js',
  './js/map.js',
  './js/users.js',
  './js/docs.js',
  './js/schedule.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Best-effort: nếu 1 file fail, vẫn cache phần còn lại
      Promise.allSettled(SHELL.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Network only cho Apps Script + Cloudinary + Nominatim + OSM tile + Leaflet CDN
  if (url.includes('script.google.com') || url.includes('cloudinary.com') ||
      url.includes('googleusercontent.com') || url.includes('nominatim.openstreetmap.org') ||
      url.includes('tile.openstreetmap.org') || url.includes('unpkg.com/leaflet')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Tailwind CDN: cache-first
  if (url.includes('cdn.tailwindcss.com')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Mặc định: stale-while-revalidate (trả cache nếu có, đồng thời update nền)
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(res => {
        if (res.ok && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
