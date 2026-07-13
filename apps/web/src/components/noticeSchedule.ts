// 공고의 접수·발표·계약 일정을 달력과 카드가 같은 규칙으로 읽게 하는 화면용 순수함수다.
import type { ApplicationEvent, Notice } from "@zoopzoopcall/core";

const DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function scheduleDateKey(value: number | string): string {
  return DATE.format(typeof value === "number" ? new Date(value) : new Date(value));
}

function allDayEvent(
  kind: ApplicationEvent["kind"],
  label: string,
  value?: string,
  endValue?: string,
): ApplicationEvent | null {
  if (!value) return null;
  const start = new Date(`${value.slice(0, 10)}T00:00:00+09:00`).toISOString();
  const end = new Date(`${(endValue ?? value).slice(0, 10)}T23:59:00+09:00`).toISOString();
  return { kind, label, start, end };
}

export function noticeSchedule(notice: Notice): ApplicationEvent[] {
  if (notice.events?.length) return notice.events;
  return [
    allDayEvent("announce", "모집공고", notice.announceDate),
    { kind: "receipt" as const, label: "청약 접수", start: notice.receiptStart, end: notice.receiptEnd },
    allDayEvent("winner", "당첨자 발표", notice.winnerDate),
    allDayEvent("contract", "계약", notice.contractStartDate, notice.contractEndDate),
  ]
    .filter((item): item is ApplicationEvent => item !== null)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function noticeHasScheduleOn(notice: Notice, dateKey: string): boolean {
  return noticeSchedule(notice).some((item) => {
    const start = scheduleDateKey(item.start);
    const end = scheduleDateKey(item.end ?? item.start);
    return dateKey >= start && dateKey <= end;
  });
}

export function nextNoticeEvent(notice: Notice, now: number): ApplicationEvent | null {
  return noticeSchedule(notice)
    .filter((item) => Date.parse(item.end ?? item.start) >= now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] ?? null;
}
