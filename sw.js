// sw.js — the "service worker". It keeps a copy of the app's files on the
// phone so Intreaty opens instantly and works with no internet.
//
// IMPORTANT: when you publish a change, raise VERSION below (and APP_VERSION
// in js/version.js). That's how phones know a new version exists.

const VERSION = '1.4.0';
const CACHE = `intreaty-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/version.js',
  './js/pwa.js',
  './js/data/models.js',
  './js/data/repository.js',
  './js/data/backup.js',
  './js/data/verses.js',
  './js/storage/local-adapter.js',
  './js/ui/dom.js',
  './js/ui/icons.js',
  './js/ui/sheet.js',
  './js/ui/theme.js',
  './js/ui/list-view.js',
  './js/ui/entry-sheets.js',
  './js/ui/settings-view.js',
  './js/ui/verse-sheet.js',
  './js/ui/paste-sheet.js',
  './js/ui/jesus-view.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('intreaty-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The app asks the new version to take over when you tap "Refresh".
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Opening the app: use the saved copy of the page.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((hit) => hit || fetch(req)),
    );
    return;
  }

  // Everything else: saved copy first, otherwise fetch and save it.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    })),
  );
});
