// 청약봄 서비스워커. 앱 셸 캐시(오프라인)와 알림 클릭 처리를 담당한다.
// 캐시 이름을 올리면 activate 단계에서 이전 버전 캐시(zzc-v1 등)가 자동 삭제된다.
const CACHE = "zzc-v0.14.6";
const CACHE_PREFIX = "zzc-";

// 설치 직후 오프라인에서도 아이콘·매니페스트가 보이도록 앱 셸을 미리 캐시한다.
// 경로는 sw.js 위치 기준 상대경로만 사용해 base path(/homebom/)를 하드코딩하지 않는다.
const APP_SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icons/icon-v2.svg",
  "./icons/apple-touch-icon-v2.png",
  "./icons/icon-192-v2.png",
  "./icons/icon-512-v2.png",
  "./icons/maskable-512-v2.png",
  "./robom-family/app-meta.json",
  "./robom-family/settings-contract.json",
  "./robom-family/feature-flags.json",
  "./robom-family/auth-config.json",
  "./robom-family/wordmark.svg",
  "./robom-family/icons.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 개별 자산 실패가 설치 전체를 막지 않도록 하나씩 담고 실패는 무시한다.
      await Promise.all(APP_SHELL.map((path) => cache.add(path).catch(() => {})));
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
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
        if (res.ok) {
          // 저장 공간 부족 등 cache.put 실패가 유효한 네트워크 응답까지 실패시키지 않게 격리한다.
          try {
            await cache.put(event.request, res.clone());
          } catch {
            // 네트워크 응답은 그대로 반환한다.
          }
        }
        return res;
      } catch (err) {
        const hit = await cache.match(event.request, { ignoreSearch: true });
        if (hit) return hit;
        if (event.request.mode === "navigate") {
          const shell = await cache.match("./");
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || self.registration.scope, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (!client.url.startsWith(self.location.origin)) continue;
        if ("navigate" in client) await client.navigate(target);
        return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
