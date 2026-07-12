// 월(月) 캘린더 격자 계산 순수 로직과 KST 날짜 키. DOM 없이 단위 테스트한다.
import type { Notice } from "@zoopzoopcall/core";

const DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// 캘린더 날짜 키(KST YYYY-MM-DD). 이 규칙은 ListScreen의 날짜 필터와 반드시 동일해야 한다.
export function calendarDateKey(value: number | string): string {
  return DATE.format(typeof value === "number" ? new Date(value) : new Date(value));
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type MonthCell = {
  /** in-month이면 YYYY-MM-DD, 빈 칸이면 "". */
  key: string;
  /** 1~31, 빈 칸이면 0. */
  day: number;
  inMonth: boolean;
  today: boolean;
  /** 그날 접수를 시작하는 공고 수. */
  starts: number;
  /** 그날 접수를 마감하는 공고 수. */
  ends: number;
};

export type MonthGrid = {
  year: number;
  /** 1~12. */
  month: number;
  label: string;
  cells: MonthCell[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const blankCell = (): MonthCell => ({ key: "", day: 0, inMonth: false, today: false, starts: 0, ends: 0 });

/**
 * now(현재 시각)가 속한 KST 월의 달력 격자를 만든다.
 * 요일 판정·일수 계산은 타임존과 무관한 순수 달력 연산(Date.UTC)으로 하고,
 * 공고 매칭은 calendarDateKey로만 파생해 ListScreen 필터와 정합을 보장한다.
 */
export function buildMonthGrid(now: number, notices: Notice[]): MonthGrid {
  const todayKey = calendarDateKey(now);
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7)); // 1~12
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=일

  const startCount = new Map<string, number>();
  const endCount = new Map<string, number>();
  for (const notice of notices) {
    const s = calendarDateKey(notice.receiptStart);
    startCount.set(s, (startCount.get(s) ?? 0) + 1);
    const e = calendarDateKey(notice.receiptEnd);
    endCount.set(e, (endCount.get(e) ?? 0) + 1);
  }

  const cells: MonthCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(blankCell());
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${pad(month)}-${pad(day)}`;
    cells.push({
      key,
      day,
      inMonth: true,
      today: key === todayKey,
      starts: startCount.get(key) ?? 0,
      ends: endCount.get(key) ?? 0,
    });
  }
  while (cells.length % 7 !== 0) cells.push(blankCell());

  return { year, month, label: `${year}년 ${month}월`, cells };
}
