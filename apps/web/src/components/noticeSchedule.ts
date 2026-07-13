// 공고의 접수·발표·계약 일정을 달력과 카드가 같은 규칙으로 읽게 하는 화면용 순수함수다.
import type { ApplicationEvent, ApplicationEventKind, Notice } from "@zoopzoopcall/core";

const DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function scheduleDateKey(value: number | string): string {
  return DATE.format(typeof value === "number" ? new Date(value) : new Date(value));
}

const REGION_PRIORITY = {
  local: 0,
  gyeonggi: 1,
  other: 2,
  all: 3,
  "not-applicable": 4,
} as const;

/** 달력·agenda·상세·알림이 공유하는 청약 일정 의미 순서다. */
export function eventPriority(event: ApplicationEvent, notice?: Notice): number {
  if (event.kind === "special") return 10;
  if (event.kind === "rank1") return 20 + REGION_PRIORITY[event.regionScope ?? "not-applicable"];
  if (event.kind === "rank2") return 30 + REGION_PRIORITY[event.regionScope ?? "not-applicable"];
  if (event.kind === "no-priority") {
    const resupply = notice && ["불법행위 재공급", "취소후재공급", "임의공급"].includes(notice.type);
    return resupply ? 41 : 40;
  }
  if (event.kind === "receipt") return 50;
  if (event.kind === "winner") return 60;
  if (event.kind === "contract") return 70;
  return 80;
}

export function compareScheduleEvents(a: ApplicationEvent, b: ApplicationEvent, noticeA?: Notice, noticeB?: Notice): number {
  return Date.parse(a.start) - Date.parse(b.start)
    || eventPriority(a, noticeA) - eventPriority(b, noticeB)
    || (noticeA?.houseName ?? "").localeCompare(noticeB?.houseName ?? "", "ko");
}

export function shortEventLabel(event: ApplicationEvent, notice?: Notice): string {
  if (event.kind === "special") return "특공";
  if (event.kind === "rank1") return "1순위";
  if (event.kind === "rank2") return "2순위";
  if (event.kind === "no-priority") {
    return notice && ["불법행위 재공급", "취소후재공급", "임의공급"].includes(notice.type) ? "재공급" : "무순위";
  }
  if (event.kind === "winner") return "발표";
  if (event.kind === "contract") return "계약";
  if (event.kind === "announce") return "공고";
  return "접수";
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
  const source = notice.events?.length ? notice.events : [
    allDayEvent("announce", "모집공고", notice.announceDate),
    {
      kind: notice.type === "일반공급" ? "receipt" as const : "no-priority" as const,
      label: notice.type === "일반공급" ? "전체 접수 기간" : "무순위·잔여 접수",
      start: notice.receiptStart,
      end: notice.receiptEnd,
    },
    allDayEvent("winner", "당첨자 발표", notice.winnerDate),
    allDayEvent("contract", "계약", notice.contractStartDate, notice.contractEndDate),
  ].filter((item): item is ApplicationEvent => item !== null);

  const hasDetailedReceipt = source.some((item) => ["special", "rank1", "rank2"].includes(item.kind));
  return source
    .filter((item) => !(hasDetailedReceipt && item.kind === "receipt"))
    .map((item, index) => ({
      ...item,
      id: item.id || `${notice.id}:${item.sourceField || `${item.kind}-${index}`}`,
      noticeId: item.noticeId || notice.id,
      regionScope: item.regionScope || "not-applicable" as const,
      confirmed: item.confirmed ?? false,
    }))
    .sort((a, b) => compareScheduleEvents(a, b, notice, notice));
}

export const EVENT_FILTER_KINDS = {
  전체: [] as ApplicationEventKind[],
  특별공급: ["special"],
  "1순위": ["rank1"],
  "2순위": ["rank2"],
  "무순위·잔여": ["no-priority"],
  재공급: ["no-priority"],
  "발표·계약": ["winner", "contract"],
} as const;

export type EventFilter = keyof typeof EVENT_FILTER_KINDS;

export function noticeMatchesEventFilter(notice: Notice, filter: EventFilter): boolean {
  if (filter === "전체") return true;
  if (filter === "재공급") {
    return notice.type === "불법행위 재공급" || notice.type === "취소후재공급";
  }
  const kinds = EVENT_FILTER_KINDS[filter];
  return noticeSchedule(notice).some((item) => (kinds as readonly ApplicationEventKind[]).includes(item.kind));
}

export function eventsOnDate(notice: Notice, dateKey: string): ApplicationEvent[] {
  return noticeSchedule(notice).filter((item) => {
    const start = scheduleDateKey(item.start);
    const end = scheduleDateKey(item.end ?? item.start);
    return dateKey >= start && dateKey <= end;
  });
}

export function noticeHasScheduleOn(notice: Notice, dateKey: string): boolean {
  return eventsOnDate(notice, dateKey).length > 0;
}

export function nextNoticeEvent(notice: Notice, now: number): ApplicationEvent | null {
  return noticeSchedule(notice)
    .filter((item) => Date.parse(item.end ?? item.start) >= now)
    .sort((a, b) => compareScheduleEvents(a, b, notice, notice))[0] ?? null;
}
