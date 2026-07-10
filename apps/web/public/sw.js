// 줍줍콜 서비스워커. 앱 셸 캐시(오프라인)와 알림 클릭 처리를 담당한다.
// 캐시 이름을 올리면 activate 단계에서 이전 버전 캐시(zzc-v1 등)가 자동 삭제된다.
const CACHE = "zzc-v2";

self.addEventListener("install", () => {
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
