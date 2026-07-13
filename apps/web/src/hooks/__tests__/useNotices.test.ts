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
      clear: () => store.clear(),
    });
  });
  it("마지막 성공 응답을 저장하고 복구한다", () => {
    localStorage.clear();
    const value = { notices: [], verifiedAt: "2026-07-13T00:00:00Z", savedAt: "2026-07-13T00:01:00Z" };
    expect(saveLastKnownNotices(value)).toBe(true);
    expect(loadLastKnownNotices()).toEqual(value);
  });

  it("깨진 캐시는 무시한다", () => {
    localStorage.setItem("homebom:notices:lkg:v1", "{");
    expect(loadLastKnownNotices()).toBeNull();
  });
});
