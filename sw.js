// Service worker: aplikasi tetap terbuka cepat & bisa dipasang (PWA).
// Naikkan VERSION setiap kali kamu upload perubahan file ke GitHub.
const VERSION = 'v1.0.0';
const CACHE = 'stok-gudang-' + VERSION;
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/supa.js', 'js/ui.js', 'js/nav.js', 'js/store.js', 'js/auth.js', 'js/tour.js', 'js/scanner.js', 'js/shopee.js',
  'assets/icon-192.png', 'assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // data Supabase selalu langsung dari server
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;
  // file aplikasi sendiri: ambil versi terbaru, kalau offline pakai cache
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }
  // library CDN & font: cache dulu
  e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = e.notification.data?.link || '#/notifikasi';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    for (const c of list) { c.navigate(c.url.split('#')[0] + link); return c.focus(); }
    return self.clients.openWindow('./' + link);
  }));
});
