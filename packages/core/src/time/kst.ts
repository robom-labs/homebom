// KST(Asia/Seoul) 표기와 D-day, 남은 시간 계산 순수함수.

export const KST_TZ = "Asia/Seoul";

const DAY_MS = 86_400_000;

/** UTC 시각(ms)을 KST 달력 날짜 문자열(YYYY-MM-DD)로 변환한다. */
export function kstDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** KST 달력 기준 D-day. 오늘이면 0, 내일이면 1, 지났으면 음수. */
export function ddayKst(targetIso: string, now: number): number {
  const target = Date.parse(targetIso);
  const t = kstDateKey(target).split("-").map(Number);
  const n = kstDateKey(now).split("-").map(Number);
  return Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(n[0], n[1] - 1, n[2])) / DAY_MS);
}

/** "7월 10일 (금) 09:00" 형태의 KST 표기. */
export function formatKstDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TZ,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} ${time}`;
}

/** "2026.07.10" 형태의 KST 날짜 표기. */
export function formatKstDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(iso))
    .replace(/\s/g, "")
    .replace(/\.$/, "");
}

/**
 * 남은 시간을 사람이 읽기 쉬운 한국어로 표기한다.
 * 1일 이상 → "N일 H시간", 1시간 이상 → "H시간 M분",
 * 1분 이상 → "M분 S초"(withSeconds) 또는 "M분", 그 미만 → "S초".
 */
export function formatRemaining(ms: number, withSeconds = false): string {
  if (ms <= 0) return "종료";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  if (hours > 0) return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  if (mins > 0) return withSeconds ? `${mins}분 ${secs}초` : `${mins}분`;
  return `${secs}초`;
}

/** 만원 단위 금액을 "4억 8,500만원" 형태로 표기한다. */
export function formatManwon(manwon: number): string {
  const eok = Math.floor(manwon / 10000);
  const rest = manwon % 10000;
  if (eok > 0 && rest > 0) return `${eok}억 ${rest.toLocaleString("ko-KR")}만원`;
  if (eok > 0) return `${eok}억원`;
  return `${rest.toLocaleString("ko-KR")}만원`;
}
