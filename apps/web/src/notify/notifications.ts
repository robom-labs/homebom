// 웹 알림 권한 확인·요청과 실제 표시를 담당하는 어댑터.

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export function notificationSupport(): PermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    // 사파리 구버전은 콜백 방식만 지원한다.
    return new Promise((resolve) => Notification.requestPermission((p) => resolve(p)));
  }
}

/** 서비스워커가 있으면 SW 알림, 없으면 일반 Notification으로 표시한다. */
export async function showAppNotification(
  title: string,
  body: string,
  url: string,
  tag: string,
): Promise<void> {
  if (notificationSupport() !== "granted") return;
  const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`;
  const options: NotificationOptions = { body, tag, icon, data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // SW 미지원 환경은 아래 폴백을 쓴다.
  }
  new Notification(title, options);
}

/** 알림이 실제로 울리는지 확인하는 테스트 알림. 기본 5초 뒤에 울린다. */
export function fireTestNotification(delayMs = 5000): void {
  window.setTimeout(() => {
    void showAppNotification(
      "줍줍콜 테스트 알림",
      "알림이 정상 동작합니다. 접수 시작·마감도 이렇게 알려드려요.",
      window.location.href,
      "zzc-test",
    );
  }, delayMs);
}
