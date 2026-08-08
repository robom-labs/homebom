// 모바일 청약 달력의 KST 날짜 경계와 공고 기간 매칭을 검증한다.
import { describe, expect, it } from "vitest";
import type { NativeNotice } from "../domain/notice";
import {
  buildNoticeCalendarMonth,
  noticeCalendarDateKey,
  noticesForCalendarDate,
} from "../domain/noticeCalendar";

function notice(id: string, startsAt: string, endsAt?: string): NativeNotice {
  return {
    id,
    manageNo: id,
    pblancNo: id,
    title: `${id} 공고`,
    category: "아파트",
    region: "서울",
    address: "서울",
    supplyCount: 1,
    sourceLabel: "청약홈",
    officialUrl: "https://www.applyhome.co.kr",
    milestones: [{
      kind: "receipt",
      label: "접수",
      startsAt,
      ...(endsAt ? { endsAt } : {}),
      nextAction: "원문 확인",
    }],
  };
}

describe("noticeCalendar", () => {
  it("UTC 시각을 한국 날짜 키로 바꾼다", () => {
    expect(noticeCalendarDateKey("2026-08-08T15:30:00.000Z")).toBe("2026-08-09");
    expect(noticeCalendarDateKey("broken")).toBe("");
  });

  it("접수 시작일부터 마감일까지 같은 공고 한 건으로 찾는다", () => {
    const value = notice("spring", "2026-08-10T00:00:00+09:00", "2026-08-12T17:30:00+09:00");
    expect(noticesForCalendarDate([value], "2026-08-09")).toEqual([]);
    expect(noticesForCalendarDate([value], "2026-08-10")).toEqual([value]);
    expect(noticesForCalendarDate([value], "2026-08-12")).toEqual([value]);
    expect(noticesForCalendarDate([value], "2026-08-13")).toEqual([]);
  });

  it("이번 달과 다음 달의 날짜 수와 공고 건수를 보존한다", () => {
    const now = Date.parse("2026-08-08T12:00:00+09:00");
    const august = notice("august", "2026-08-15T09:00:00+09:00");
    const september = notice("september", "2026-09-01T09:00:00+09:00");
    const current = buildNoticeCalendarMonth([august, september], now, 0);
    const next = buildNoticeCalendarMonth([august, september], now, 1);
    expect(current.label).toBe("2026년 8월");
    expect(current.cells.filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(current.cells.find((cell) => cell.key === "2026-08-15")?.noticeCount).toBe(1);
    expect(next.label).toBe("2026년 9월");
    expect(next.cells.find((cell) => cell.key === "2026-09-01")?.noticeCount).toBe(1);
  });

  it("12월 다음 달을 다음 해 1월로 안전하게 넘긴다", () => {
    const now = Date.parse("2026-12-31T12:00:00+09:00");
    const january = notice("new-year", "2027-01-02T09:00:00+09:00");
    const next = buildNoticeCalendarMonth([january], now, 1);
    expect(next.label).toBe("2027년 1월");
    expect(next.cells.filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(next.cells.find((cell) => cell.key === "2027-01-02")?.noticeCount).toBe(1);
  });
});
