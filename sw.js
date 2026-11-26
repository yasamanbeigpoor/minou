// Offline support. App files: cache first, refreshed in the background.
// Lesson content: network first, so new modules show up as soon as they're pushed.
const VERSION = 'minou-v12';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'css/fonts.css',
  'fonts/fredoka-latin-500-normal.woff2', 'fonts/fredoka-latin-600-normal.woff2', 'fonts/nunito-latin-400-normal.woff2',
  'fonts/nunito-latin-600-normal.woff2', 'fonts/nunito-latin-700-normal.woff2', 'fonts/nunito-latin-800-normal.woff2',
  'fonts/nunito-latin-600-italic.woff2', 'fonts/nunito-latin-700-italic.woff2', 'fonts/vazirmatn-arabic-400-normal.woff2',
  'fonts/vazirmatn-arabic-500-normal.woff2', 'summary.html', 'icons/icon-512.png', 'icons/icon.svg', 'icons/icon-192.png',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/srs.js', 'js/data.js', 'js/questions.js', 'js/build.js',
  'js/lesson.js', 'js/minou.js', 'js/icons.js', 'js/speech.js', 'js/sound.js', 'js/numbers.js',
  'js/confetti.js', 'js/summary.js', 'js/fa.js', 'js/tour.js', 'js/sync.js',
  'content/classes.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Online progress always goes straight to the network.
  if (url.hostname.endsWith('.supabase.co')) return;
  const isContent = url.origin === location.origin && (url.pathname.includes('/content/') || url.pathname.includes('/summaries/'));

  // Recordings never change (their names come from a hash of the text), so cache them on first play.
  if (url.origin === location.origin && url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  if (isContent || url.pathname.endsWith('/audio/index.json')) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      if (res.ok) caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  e.respondWith(caches.match(req, { ignoreSearch: url.origin === location.origin }).then((hit) => {
    const fresh = fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
