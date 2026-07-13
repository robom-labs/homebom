// 월(月) 캘린더 격자 계산 순수 로직과 KST 날짜 키. DOM 없이 단위 테스트한다.
import type { ApplicationEventKind, Notice } from "@zoopzoopcall/core";
import { noticeSchedule, scheduleDateKey } from "./noticeSchedule";

// 캘린더 날짜 키(KST YYYY-MM-DD). 이 규칙은 ListScreen의 날짜 필터와 반드시 동일해야 한다.
export function calendarDateKey(value: number | string): string {
  return scheduleDateKey(value);
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
  /** 당첨자 발표 수. */
  winners: number;
  /** 계약 시작 수. */
  contracts: number;
  /** 좁은 모바일 셀에 표시할 일정 라벨. 최대 두 개와 나머지 건수만 렌더한다. */
  markers: Array<{ kind: ApplicationEventKind; label: string }>;
};

export type MonthGrid = {
  year: number;
  /** 1~12. */
  month: number;
  label: string;
  /** 이 달에 일정이 하나라도 있는 고유 공고 수. */
  noticeCount: number;
  cells: MonthCell[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const blankCell = (): MonthCell => ({
  key: "",
  day: 0,
  inMonth: false,
  today: false,
  starts: 0,
  ends: 0,
  winners: 0,
  contracts: 0,
  markers: [],
});

/**
 * now(현재 시각)가 속한 KST 월의 달력 격자를 만든다.
 * 요일 판정·일수 계산은 타임존과 무관한 순수 달력 연산(Date.UTC)으로 하고,
 * 공고 매칭은 calendarDateKey로만 파생해 ListScreen 필터와 정합을 보장한다.
 */
export function buildMonthGrid(now: number, notices: Notice[], viewYear?: number, viewMonth?: number): MonthGrid {
  const todayKey = calendarDateKey(now);
  const year = viewYear ?? Number(todayKey.slice(0, 4));
  const month = viewMonth ?? Number(todayKey.slice(5, 7)); // 1~12
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=일

  const startCount = new Map<string, number>();
  const endCount = new Map<string, number>();
  const winnerCount = new Map<string, number>();
  const contractCount = new Map<string, number>();
  const markers = new Map<string, Array<{ kind: ApplicationEventKind; label: string }>>();
  const monthPrefix = `${year}-${pad(month)}`;
  const noticeIds = new Set<string>();
  for (const notice of notices) {
    for (const item of noticeSchedule(notice)) {
      const s = calendarDateKey(item.start);
      const e = calendarDateKey(item.end ?? item.start);
      if (s.startsWith(monthPrefix) || e.startsWith(monthPrefix) || (s < `${monthPrefix}-01` && e > `${monthPrefix}-01`)) {
        noticeIds.add(notice.id);
      }
      if (["receipt", "special", "rank1", "rank2", "no-priority"].includes(item.kind)) {
        startCount.set(s, (startCount.get(s) ?? 0) + 1);
        endCount.set(e, (endCount.get(e) ?? 0) + 1);
      } else if (item.kind === "winner") {
        winnerCount.set(s, (winnerCount.get(s) ?? 0) + 1);
      } else if (item.kind === "contract") {
        contractCount.set(s, (contractCount.get(s) ?? 0) + 1);
      }
      const dayMarkers = markers.get(s) ?? [];
      if (!dayMarkers.some((marker) => marker.kind === item.kind && marker.label === item.label)) {
        dayMarkers.push({ kind: item.kind, label: item.label.replace("전체 접수 기간", "접수").replace("당첨자 발표", "발표") });
        markers.set(s, dayMarkers);
      }
    }
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
      winners: winnerCount.get(key) ?? 0,
      contracts: contractCount.get(key) ?? 0,
      markers: markers.get(key) ?? [],
    });
  }
  while (cells.length % 7 !== 0) cells.push(blankCell());

  return { year, month, label: `${year}년 ${month}월`, noticeCount: noticeIds.size, cells };
}
