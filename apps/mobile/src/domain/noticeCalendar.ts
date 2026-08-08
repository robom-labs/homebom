// 청약 공고의 한국시간 일정을 월간 달력과 날짜별 목록으로 바꾸는 순수 규칙이다.
import type { NativeNotice, NoticeMilestone } from "./notice";

export const calendarWeekdays = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type NoticeCalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  noticeCount: number;
  kinds: NoticeMilestone["kind"][];
};

export type NoticeCalendarMonth = {
  year: number;
  month: number;
  label: string;
  cells: NoticeCalendarCell[];
};

const kstDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

const pad = (value: number) => String(value).padStart(2, "0");

export function noticeCalendarDateKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return kstDateFormatter.format(date);
}

function milestoneDateRange(milestone: NoticeMilestone): { start: string; end: string } | null {
  const start = noticeCalendarDateKey(milestone.startsAt);
  const end = noticeCalendarDateKey(milestone.endsAt ?? milestone.startsAt);
  if (!start || !end || start > end) return null;
  return { start, end };
}

export function noticeHasCalendarDate(notice: NativeNotice, dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateKey)) return false;
  return notice.milestones.some((milestone) => {
    const range = milestoneDateRange(milestone);
    return Boolean(range && range.start <= dateKey && range.end >= dateKey);
  });
}

export function noticesForCalendarDate(
  notices: readonly NativeNotice[],
  dateKey: string,
): NativeNotice[] {
  return notices.filter((notice) => noticeHasCalendarDate(notice, dateKey));
}

function calendarKindsForDate(
  notices: readonly NativeNotice[],
  dateKey: string,
): NoticeMilestone["kind"][] {
  const kinds = new Set<NoticeMilestone["kind"]>();
  for (const notice of notices) {
    for (const milestone of notice.milestones) {
      const range = milestoneDateRange(milestone);
      if (range && range.start <= dateKey && range.end >= dateKey) kinds.add(milestone.kind);
    }
  }
  return [...kinds];
}

export function buildNoticeCalendarMonth(
  notices: readonly NativeNotice[],
  now = Date.now(),
  monthOffset = 0,
): NoticeCalendarMonth {
  const today = noticeCalendarDateKey(now);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const view = new Date(Date.UTC(currentYear, currentMonth - 1 + monthOffset, 1));
  const year = view.getUTCFullYear();
  const month = view.getUTCMonth() + 1;
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: NoticeCalendarCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: "", day: 0, inMonth: false, today: false, noticeCount: 0, kinds: [] });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${pad(month)}-${pad(day)}`;
    const matching = noticesForCalendarDate(notices, key);
    cells.push({
      key,
      day,
      inMonth: true,
      today: key === today,
      noticeCount: matching.length,
      kinds: calendarKindsForDate(matching, key),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: "", day: 0, inMonth: false, today: false, noticeCount: 0, kinds: [] });
  }

  return { year, month, label: `${year}년 ${month}월`, cells };
}
