// 오래 켜둔 네이티브 앱이 전면 복귀할 때 실공고를 다시 확인할지 결정한다.
export const FOREGROUND_REFRESH_AFTER_MS = 10 * 60 * 1000;

export function shouldRefreshOnForeground(
  lastLoadedAt: number,
  now: number,
  thresholdMs = FOREGROUND_REFRESH_AFTER_MS,
): boolean {
  return Number.isFinite(lastLoadedAt) && Number.isFinite(now) && now - lastLoadedAt >= thresholdMs;
}
