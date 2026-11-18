// Panda Workout — offline support.
// Keeps a copy of the app so it opens with no connection. Your logged data is not
// touched by this file; it stays in the browser's local storage.
// When online, the newest index.html is always fetched, so updates you push to
// GitHub Pages show up on the next open without changing anything here.
const CACHE = 'panda-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  if (isFont) {
    // Fonts rarely change: serve the saved copy, fetch once if there is none.
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // App files: try the network (3 s limit, for weak gym signal), fall back to the saved copy.
  event.respondWith(
    new Promise(resolve => {
      let settled = false;
      const fromCache = () => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
        .then(hit => hit || Response.error());
      const timer = setTimeout(() => { if (!settled) { settled = true; resolve(fromCache()); } }, 3000);
      fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
      }).catch(() => {
        if (!settled) { settled = true; clearTimeout(timer); resolve(fromCache()); }
      });
    })
  );
});
