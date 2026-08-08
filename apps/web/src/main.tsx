// 엔트리포인트: 루트 렌더와 서비스워커 등록.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { PwaInstallProvider } from "./pwa/PwaInstallProvider";
import "./generated/robom-family/tokens.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PwaInstallProvider>
      <App />
    </PwaInstallProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  // 최초 설치의 clients.claim()은 controllerchange를 일으키지만 현재 페이지는 이미 최신 셸이다.
  // 기존 서비스워커가 있던 실제 업데이트에서만 한 번 새로고침해 입력 중 화면을 불필요하게 끊지 않는다.
  const hadServiceWorkerController = navigator.serviceWorker.controller !== null;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      registration.addEventListener("updatefound", () => {
        registration.installing?.addEventListener("statechange", () => {
          if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
        });
      });
    });
  });
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadServiceWorkerController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
