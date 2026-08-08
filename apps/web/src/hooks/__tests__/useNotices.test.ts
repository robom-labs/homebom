// 청약 공고 응답 헤더가 공식·확인 지연 상태로 정확히 변환되는지 검증한다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadLastKnownNotices, noticeResponseMeta, saveLastKnownNotices } from "../useNotices";

describe("noticeResponseMeta", () => {
  it("일반 응답은 공식 데이터로 표시한다", () => {
    expect(noticeResponseMeta(new Headers({ "x-verified-at": "2026-07-13T00:00:00Z" }))).toEqual({
      source: "live",
      verifiedAt: "2026-07-13T00:00:00Z",
    });
  });

  it("stale 헤더가 있으면 확인 지연 상태와 마지막 확인 시각을 보존한다", () => {
    expect(
      noticeResponseMeta(
        new Headers({
          "x-data-stale": "1",
          "x-verified-at": "2026-07-12T23:00:00Z",
        }),
      ),
    ).toEqual({
      source: "stale",
      verifiedAt: "2026-07-12T23:00:00Z",
    });
  });
});

describe("last known good notices", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    });
  });
  it("마지막 성공 응답을 저장하고 복구한다", () => {
    localStorage.clear();
    const value = {
      notices: [{
        id: "active-1",
        type: "무순위" as const,
        houseName: "검증 단지",
        region: "서울",
        receiptStart: "2099-07-14T00:00:00Z",
        receiptEnd: "2099-07-15T14:59:00Z",
        applyHomeUrl: "https://www.applyhome.co.kr/",
        lastVerifiedAt: "2026-07-13T00:00:00Z",
      }],
      verifiedAt: "2026-07-13T00:00:00Z",
      savedAt: new Date().toISOString(),
    };
    expect(saveLastKnownNotices(value)).toBe(true);
    expect(loadLastKnownNotices()).toEqual(value);
  });

  it("접수 마감 경계에서 저장과 복원은 같은 기준 시각을 쓴다", () => {
    const boundary = Date.parse("2026-08-09T00:00:00.000Z");
    const value = {
      notices: [{
        id: "boundary-1",
        type: "무순위" as const,
        houseName: "경계 단지",
        region: "서울",
        receiptStart: "2026-08-08T00:00:00.000Z",
        receiptEnd: new Date(boundary).toISOString(),
        applyHomeUrl: "https://www.applyhome.co.kr/",
        lastVerifiedAt: "2026-08-08T00:00:00.000Z",
      }],
      verifiedAt: "2026-08-08T00:00:00.000Z",
      savedAt: new Date(boundary - 1).toISOString(),
    };

    expect(saveLastKnownNotices(value, boundary - 1)).toBe(true);
    expect(loadLastKnownNotices(boundary - 1)?.notices).toHaveLength(1);
    expect(loadLastKnownNotices(boundary + 1)).toBeNull();
  });

  it("깨진 캐시는 무시한다", () => {
    localStorage.setItem("homebom:notices:lkg:v1", "{");
    expect(loadLastKnownNotices()).toBeNull();
  });

  it("7일이 지난 저장본은 폐기한다", () => {
    localStorage.setItem("homebom:notices:lkg:v1", JSON.stringify({
      notices: [{
        id: "future-1",
        type: "무순위",
        houseName: "미래 단지",
        region: "서울",
        receiptStart: "2099-07-14T00:00:00Z",
        receiptEnd: "2099-07-15T14:59:00Z",
        applyHomeUrl: "https://www.applyhome.co.kr/",
        lastVerifiedAt: "2026-07-13T00:00:00Z",
      }],
      verifiedAt: "2026-07-13T00:00:00Z",
      savedAt: new Date(Date.now() - 169 * 60 * 60 * 1000).toISOString(),
    }));
    expect(loadLastKnownNotices()).toBeNull();
  });

  it("접수가 끝난 공고만 남은 저장본은 폐기한다", () => {
    localStorage.setItem("homebom:notices:lkg:v1", JSON.stringify({
      notices: [{
        id: "expired-1",
        type: "무순위",
        houseName: "종료 단지",
        region: "서울",
        receiptStart: "2020-07-14T00:00:00Z",
        receiptEnd: "2020-07-15T14:59:00Z",
        applyHomeUrl: "https://www.applyhome.co.kr/",
        lastVerifiedAt: "2020-07-13T00:00:00Z",
      }],
      verifiedAt: "2020-07-13T00:00:00Z",
      savedAt: new Date().toISOString(),
    }));
    expect(loadLastKnownNotices()).toBeNull();
  });
});
