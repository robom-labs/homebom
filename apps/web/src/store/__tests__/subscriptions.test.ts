import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notice } from "@zoopzoopcall/core";
import { loadSubs, migrateLegacyNoticeKeys, saveSubs } from "../subscriptions";

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
});

function notice(overrides: Partial<Notice> = {}): Notice {
  return {
    id: "manage-100-2026-07-10",
    legacyIds: ["100-"],
    manageNo: "100",
    type: "무순위",
    houseName: "테스트 단지",
    region: "서울",
    receiptStart: "2026-07-10T00:00:00.000Z",
    receiptEnd: "2026-07-10T08:30:00.000Z",
    applyHomeUrl: "https://www.applyhome.co.kr",
    lastVerifiedAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("migrateLegacyNoticeKeys", () => {
  it("기존 한쪽 번호 ID의 구독과 snapshot을 안정 ID로 옮긴다", () => {
    const current = notice();
    const legacySnapshot = notice({ id: "100-", legacyIds: undefined });
    const result = migrateLegacyNoticeKeys(
      [current],
      { "100-": { open: [60], close: [60] } },
      { "100-": legacySnapshot },
    );

    expect(result.changed).toBe(true);
    expect(result.subs[current.id]).toEqual({ open: [60], close: [60] });
    expect(result.subs["100-"]).toBeUndefined();
    expect(result.snapshots[current.id]).toEqual(current);
    expect(result.snapshots["100-"]).toBeUndefined();
  });

  it("이전 ID 구독이 없으면 저장값을 바꾸지 않는다", () => {
    const current = notice();
    const result = migrateLegacyNoticeKeys([current], {}, {});
    expect(result.changed).toBe(false);
    expect(result.subs).toEqual({});
  });
});

describe("구독 저장 버전 호환", () => {
  it("v1 구독을 처음 읽을 때 v2로 복사한다", () => {
    store.set("zzc:subs:v1", JSON.stringify({ old: { open: [60], close: [] } }));
    expect(loadSubs()).toEqual({ old: { open: [60], close: [] } });
    expect(store.get("zzc:subs:v2")).toBe(store.get("zzc:subs:v1"));
  });

  it("새 구독은 v1과 v2에 함께 저장한다", () => {
    const value = { current: { open: [0], close: [60], eventIds: ["event-1"] } };
    saveSubs(value);
    expect(JSON.parse(store.get("zzc:subs:v1")!)).toEqual(value);
    expect(JSON.parse(store.get("zzc:subs:v2")!)).toEqual(value);
  });
});
