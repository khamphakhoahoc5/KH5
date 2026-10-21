/* Khám phá Khoa học 5. Đổi VERSION khi thay đổi bất kỳ tệp website nào. */
'use strict';
const VERSION = '2026.10.21-ab14aa8ed6bf';
const BASE = new URL(self.registration.scope);
const PREFIX = 'kh5-pwa:' + BASE.href + ':';
const CACHE = PREFIX + VERSION;
const CORE = ["index.html", "pwa.js", "pwa.css", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
const CORE_URLS = CORE.map(path => new URL(path, BASE).href);
const INDEX_URL = new URL('index.html', BASE).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE_URLS.map(url => new Request(url, {cache:'reload'})));
    // Bản mới chờ người dùng đóng các tab hoặc chủ động chọn cập nhật.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'KH5_ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  }
  if (event.data && event.data.type === 'KH5_OFFLINE_STATUS' && event.ports && event.ports[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const results = await Promise.all(CORE_URLS.map(url => cache.match(url)));
      event.ports[0].postMessage({ready:results.every(Boolean),version:VERSION});
    })());
  }
});
async function cachedOrFetch(url) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;
  const response = await fetch(new Request(url, {cache:'no-cache'}));
  if (response.ok && response.type !== 'opaque') await cache.put(url, response.clone());
  return response;
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin) return;
  const clean = new URL(url.href); clean.search = ''; clean.hash = '';
  const isHome = clean.href === BASE.href || clean.href === INDEX_URL;
  if (request.mode === 'navigate' && isHome) {
    event.respondWith(cachedOrFetch(INDEX_URL).catch(() => new Response(
      '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Khám phá Khoa học 5</title><body style="font:20px/1.6 system-ui;max-width:650px;margin:60px auto;padding:24px"><h1>Chưa có bản lưu ngoại tuyến</h1><p>Hãy kết nối mạng và mở lại website. Chờ thông báo sẵn sàng dùng ngoại tuyến trước khi ngắt kết nối.</p><a href="./">Mở lại học liệu</a></body></html>',
      {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}}
    )));
    return;
  }
  if (CORE_URLS.includes(clean.href)) event.respondWith(cachedOrFetch(clean.href));
});
