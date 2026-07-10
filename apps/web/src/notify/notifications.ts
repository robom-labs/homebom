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
): Promise<boolean> {
  if (notificationSupport() !== "granted") return false;
  const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`;
  const options: NotificationOptions = { body, tag, icon, data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    // SW 미지원 환경은 아래 폴백을 쓴다.
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
