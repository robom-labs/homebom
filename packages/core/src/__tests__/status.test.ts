// 공고 상태 판정 순수함수 테스트.
import { describe, expect, it } from "vitest";
import { getNoticeStatus, isClosingSoon } from "../notice/status";
import type { Notice } from "../notice/types";

const base: Notice = {
  id: "t-1",
  type: "무순위",
  houseName: "테스트 단지",
  region: "서울",
  receiptStart: "2026-07-10T00:00:00.000Z",
  receiptEnd: "2026-07-10T08:30:00.000Z",
  applyHomeUrl: "https://www.applyhome.co.kr",
  lastVerifiedAt: "2026-07-01T00:00:00.000Z",
};

const T = (iso: string) => Date.parse(iso);

describe("getNoticeStatus", () => {
  it("접수 시작 전이면 예정", () => {
    expect(getNoticeStatus(base, T("2026-07-09T00:00:00Z"))).toBe("예정");
  });

  it("접수 시작 직전 1ms까지 예정", () => {
    expect(getNoticeStatus(base, T("2026-07-10T00:00:00Z") - 1)).toBe("예정");
  });

  it("접수 기간 안이면 접수중 (경계 포함)", () => {
    expect(getNoticeStatus(base, T("2026-07-10T00:00:00Z"))).toBe("접수중");
    expect(getNoticeStatus(base, T("2026-07-10T08:30:00Z"))).toBe("접수중");
  });

  it("접수 종료 후면 마감", () => {
    expect(getNoticeStatus(base, T("2026-07-10T08:30:00Z") + 1)).toBe("마감");
  });

  it("취소공고는 시각과 무관하게 취소", () => {
    const cancelled = { ...base, cancelled: true };
    expect(getNoticeStatus(cancelled, T("2026-07-01T00:00:00Z"))).toBe("취소");
    expect(getNoticeStatus(cancelled, T("2026-07-20T00:00:00Z"))).toBe("취소");
  });

  it("정정공고는 접수 시작 전에만 정정으로 표시", () => {
    const corrected = { ...base, corrected: true };
    expect(getNoticeStatus(corrected, T("2026-07-09T00:00:00Z"))).toBe("정정");
    expect(getNoticeStatus(corrected, T("2026-07-10T01:00:00Z"))).toBe("접수중");
  });
});

describe("isClosingSoon", () => {
  it("접수중이고 마감 6시간 이내면 true", () => {
    expect(isClosingSoon(base, T("2026-07-10T03:00:00Z"))).toBe(true);
  });

  it("접수중이어도 마감까지 6시간 넘게 남으면 false", () => {
    expect(isClosingSoon(base, T("2026-07-10T00:30:00Z"))).toBe(false);
  });

  it("예정/마감 상태면 false", () => {
    expect(isClosingSoon(base, T("2026-07-09T00:00:00Z"))).toBe(false);
    expect(isClosingSoon(base, T("2026-07-11T00:00:00Z"))).toBe(false);
  });
});
