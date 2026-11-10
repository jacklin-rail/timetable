// Service Worker：只快取本站的頁面與圖示（App Shell）。
// TDX 的 API 請求（跨網域）一律直接連網，不經過快取，避免讀到過期時刻表或誤點資料。
// 更新頁面後，請把 VERSION 數字加 1，使用者下次開啟就會取得新版。
const VERSION = 'v1';
const CACHE = 'rail-timetable-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './thsr-timetable.html',
  './tra-timetable.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
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
  if (url.origin !== self.location.origin) return;   // TDX API 等跨網域請求直接放行

  // 頁面導覽：先連網取最新版，失敗（離線）才用快取
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 其他靜態檔：先用快取，背景更新
  event.respondWith(
    caches.match(req).then(cached => {
      const fetching = fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetching;
    })
  );
});
