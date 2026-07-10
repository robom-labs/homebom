// 줍줍콜 서비스워커. 앱 셸 캐시(오프라인)와 알림 클릭 처리를 담당한다.
const CACHE = "zzc-v2";
// self.location(=sw.js가 서빙된 경로) 기준 상대경로라 base path("/zoopzoopcall/")를 하드코딩하지 않는다.
const APP_SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 앱 셸 사전 캐시 실패(오프라인 설치 등)로 install 전체가 실패하지 않도록 개별 처리.
      await Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => {})),
      );
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(event.request, { ignoreSearch: true });
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(self.clients.openWindow(url || self.registration.scope));
});
