// 월 캘린더 격자 순수 로직 계약 테스트. ListScreen 필터와의 정합을 잠근다.
import { describe, expect, it } from "vitest";
import type { Notice } from "@zoopzoopcall/core";
import { buildMonthGrid, calendarDateKey } from "../noticeCalendar.model";

const T = (iso: string) => Date.parse(iso);

function notice(id: string, start: string, end: string): Notice {
  return {
    id,
    type: "무순위",
    houseName: `단지 ${id}`,
    region: "서울",
    receiptStart: start,
    receiptEnd: end,
    applyHomeUrl: "https://www.applyhome.co.kr",
    lastVerifiedAt: "2026-07-01T00:00:00.000Z",
  };
}

// KST 2026-07-12 (일). 7월은 31일, 1일이 수요일(요일 index 3).
const NOW = T("2026-07-12T03:00:00.000Z");

describe("buildMonthGrid", () => {
  it("현재 KST 월과 라벨을 파생한다", () => {
    const grid = buildMonthGrid(NOW, []);
    expect(grid.year).toBe(2026);
    expect(grid.month).toBe(7);
    expect(grid.label).toBe("2026년 7월");
  });

  it("앞 빈칸(1일 요일)과 월 일수만큼의 in-month 칸을 만든다", () => {
    const grid = buildMonthGrid(NOW, []);
    // 2026-07-01은 수요일 → 앞 빈칸 3개.
    expect(grid.cells.slice(0, 3).every((c) => !c.inMonth)).toBe(true);
    expect(grid.cells[3]).toMatchObject({ day: 1, inMonth: true, key: "2026-07-01" });
    expect(grid.cells.filter((c) => c.inMonth)).toHaveLength(31);
    // 격자는 7의 배수로 채워진다.
    expect(grid.cells.length % 7).toBe(0);
  });

  it("오늘 칸만 today=true다", () => {
    const grid = buildMonthGrid(NOW, []);
    const todays = grid.cells.filter((c) => c.today);
    expect(todays).toHaveLength(1);
    expect(todays[0].key).toBe(calendarDateKey(NOW));
    expect(todays[0].key).toBe("2026-07-12");
  });

  it("접수 시작·마감 건수를 해당 날짜 칸에 집계한다", () => {
    const grid = buildMonthGrid(NOW, [
      notice("a", "2026-07-13T00:00:00.000Z", "2026-07-15T08:30:00.000Z"),
      notice("b", "2026-07-13T00:00:00.000Z", "2026-07-20T08:30:00.000Z"),
    ]);
    const d13 = grid.cells.find((c) => c.key === "2026-07-13");
    const d15 = grid.cells.find((c) => c.key === "2026-07-15");
    expect(d13).toMatchObject({ starts: 2, ends: 0 });
    expect(d15).toMatchObject({ starts: 0, ends: 1 });
  });

  it("다른 달 공고는 이번 달 격자에 집계되지 않는다", () => {
    const grid = buildMonthGrid(NOW, [
      notice("c", "2026-08-03T00:00:00.000Z", "2026-08-05T08:30:00.000Z"),
    ]);
    expect(grid.cells.every((c) => c.starts === 0 && c.ends === 0)).toBe(true);
  });
});
