// 청약 공고를 접수 시기와 검색어로 찾고 알림 딥링크 대상을 복원하는 순수 규칙이다.
import type { NativeNotice, NoticeMilestone } from "./notice";

export type NoticeDateFilter = "all" | "open" | "week" | "later";

export const noticeDateFilters: readonly NoticeDateFilter[] = ["all", "open", "week", "later"];

export const noticeDateFilterLabels: Record<NoticeDateFilter, string> = {
  all: "전체",
  open: "접수 중",
  week: "7일 안",
  later: "8일 이후",
};

const DAY_MS = 86_400_000;
const kstPartsFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

export function receiptMilestone(notice: NativeNotice): NoticeMilestone | undefined {
  return notice.milestones.find((milestone) => milestone.kind === "receipt");
}

function kstDayStart(now: number): number {
  const parts = kstPartsFormatter.formatToParts(new Date(now));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) return now;
  return Date.parse(`${year}-${month}-${day}T00:00:00+09:00`);
}

export function noticeDateBucket(
  notice: NativeNotice,
  now = Date.now(),
): Exclude<NoticeDateFilter, "all"> | "unknown" {
  const receipt = receiptMilestone(notice);
  if (!receipt) return "unknown";
  const startsAt = Date.parse(receipt.startsAt);
  const endsAt = Date.parse(receipt.endsAt ?? receipt.startsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return "unknown";
  if (startsAt <= now && endsAt >= now) return "open";
  // 오늘을 0일째로 세어 7일 뒤 날짜까지가 "7일 안", 8일 뒤부터가 "8일 이후"다.
  const laterCutoff = kstDayStart(now) + 8 * DAY_MS;
  if (startsAt > now && startsAt < laterCutoff) return "week";
  if (startsAt >= laterCutoff) return "later";
  return "unknown";
}

export function countNoticeDateFilters(
  notices: readonly NativeNotice[],
  now = Date.now(),
): Record<NoticeDateFilter, number> {
  const counts: Record<NoticeDateFilter, number> = {
    all: notices.length,
    open: 0,
    week: 0,
    later: 0,
  };
  for (const notice of notices) {
    const bucket = noticeDateBucket(notice, now);
    if (bucket !== "unknown") counts[bucket] += 1;
  }
  return counts;
}

function normalizedSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/gu, "");
}

function matchesQuery(notice: NativeNotice, query: string): boolean {
  const normalized = normalizedSearchText(query.trim());
  if (!normalized) return true;
  return [notice.title, notice.region, notice.address, notice.category]
    .some((value) => normalizedSearchText(value).includes(normalized));
}

function receiptSortValue(notice: NativeNotice, filter: NoticeDateFilter): number {
  const receipt = receiptMilestone(notice);
  if (!receipt) return Number.MAX_SAFE_INTEGER;
  const value = filter === "open"
    ? Date.parse(receipt.endsAt ?? receipt.startsAt)
    : Date.parse(receipt.startsAt);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function discoverNotices(
  notices: readonly NativeNotice[],
  options: { filter: NoticeDateFilter; query: string; now?: number },
): NativeNotice[] {
  const now = options.now ?? Date.now();
  const filtered = notices.filter((notice) => (
    matchesQuery(notice, options.query)
    && (options.filter === "all" || noticeDateBucket(notice, now) === options.filter)
  ));
  if (options.filter === "all") return [...filtered];
  return [...filtered].sort((left, right) => (
    receiptSortValue(left, options.filter) - receiptSortValue(right, options.filter)
  ));
}

export function bringNoticeToFront(
  notices: readonly NativeNotice[],
  noticeId: string | null,
): NativeNotice[] {
  if (!noticeId) return [...notices];
  const index = notices.findIndex((notice) => notice.id === noticeId);
  if (index <= 0) return [...notices];
  return [notices[index] as NativeNotice, ...notices.slice(0, index), ...notices.slice(index + 1)];
}

export function noticeIdFromAppUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /^homebom:\/\/notice\/([^?#]+)(?:[?#].*)?$/u.exec(url.trim());
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function noticeIdFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = (data as { noticeId?: unknown }).noticeId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
