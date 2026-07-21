// isActiveNotice 필터, LKG 저장/복원/72시간 만료, fetch 상태 파생(live/stale/not-connected/empty/error)을 검증한다.
import { describe, expect, it, vi } from "vitest";
import type { Notice } from "@zoopzoopcall/core";
import {
  fetchNotices,
  isActiveNotice,
  LKG_KEY,
  loadLastKnownNotices,
  saveLastKnownNotices,
  type AsyncKeyValueStore,
} from "../domain/noticesFeed";

// 실제 청약홈 응답 형태를 본뜬 테스트 픽스처다. 앱 데이터로 출하되지 않는다.
function makeNotice(overrides: Partial<Notice> = {}): Notice {
  return {
    id: "2026000123-1",
    manageNo: "2026000123",
    pblancNo: "1",
    type: "무순위",
    houseName: "테스트 봄마을 1단지",
    region: "서울특별시",
    address: "서울특별시 테스트구 테스트로 1",
    supplyCount: 3,
    receiptStart: "2026-07-20T00:00:00+09:00",
    receiptEnd: "2099-01-01T00:00:00Z",
    applyHomeUrl: "https://www.applyhome.co.kr",
    lastVerifiedAt: "2026-07-09T00:00:00Z",
    ...overrides,
  };
}

function createStore(seed: Record<string, string> = {}): AsyncKeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = { ...seed };
  return {
    data,
    async getItem(key) {
      return key in data ? (data[key] as string) : null;
    },
    async setItem(key, value) {
      data[key] = value;
    },
    async removeItem(key) {
      delete data[key];
    },
  };
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response;
}

const HOUR = 60 * 60 * 1000;

describe("isActiveNotice", () => {
  const now = Date.parse("2026-07-10T00:00:00Z");
  it("취소되지 않고 접수 마감 전이면 활성이다", () => {
    expect(isActiveNotice(makeNotice({ receiptEnd: "2026-07-20T00:00:00Z" }), now)).toBe(true);
  });
  it("취소된 공고는 비활성이다", () => {
    expect(isActiveNotice(makeNotice({ cancelled: true }), now)).toBe(false);
  });
  it("접수 마감이 지난 공고는 비활성이다", () => {
    expect(isActiveNotice(makeNotice({ receiptEnd: "2026-07-01T00:00:00Z" }), now)).toBe(false);
  });
});

describe("LKG 저장/복원/만료", () => {
  it("live 공고를 저장하고 그대로 복원한다", async () => {
    const store = createStore();
    const savedAt = new Date().toISOString();
    const saved = await saveLastKnownNotices(store, { notices: [makeNotice()], verifiedAt: "2026-07-09T00:00:00Z", savedAt });
    expect(saved).toBe(true);

    const loaded = await loadLastKnownNotices(store);
    expect(loaded?.notices).toHaveLength(1);
    expect(loaded?.notices[0]?.id).toBe("2026000123-1");
    expect(loaded?.verifiedAt).toBe("2026-07-09T00:00:00Z");
  });

  it("활성 공고가 하나도 없으면 저장하지 않는다", async () => {
    const store = createStore();
    const saved = await saveLastKnownNotices(store, {
      notices: [makeNotice({ receiptEnd: "2000-01-01T00:00:00Z" })],
      verifiedAt: null,
      savedAt: new Date().toISOString(),
    });
    expect(saved).toBe(false);
    expect(store.data[LKG_KEY]).toBeUndefined();
  });

  it("저장 후 72시간이 지나면 만료로 처리하고 키를 지운다", async () => {
    const store = createStore();
    const savedAt = new Date("2026-07-10T00:00:00Z").toISOString();
    await saveLastKnownNotices(store, { notices: [makeNotice()], verifiedAt: null, savedAt });

    const within = Date.parse(savedAt) + 71 * HOUR;
    expect(await loadLastKnownNotices(store, within)).not.toBeNull();

    const expired = Date.parse(savedAt) + 73 * HOUR;
    expect(await loadLastKnownNotices(store, expired)).toBeNull();
    expect(store.data[LKG_KEY]).toBeUndefined();
  });
});

describe("fetchNotices 상태 파생", () => {
  it("URL이 없고 캐시도 없으면 not-connected다", async () => {
    const result = await fetchNotices({ url: undefined, storage: createStore() });
    expect(result.source).toBe("not-connected");
    expect(result.notices).toHaveLength(0);
    expect(result.error).toContain("연결이 아직 완료되지 않았습니다");
  });

  it("URL이 없어도 캐시가 있으면 stale로 마지막 확인본을 보여준다", async () => {
    const store = createStore();
    await saveLastKnownNotices(store, { notices: [makeNotice()], verifiedAt: null, savedAt: new Date().toISOString() });
    const result = await fetchNotices({ url: undefined, storage: store });
    expect(result.source).toBe("stale");
    expect(result.notices).toHaveLength(1);
  });

  it("live 응답을 받으면 live 상태로 노출하고 LKG에 저장한다", async () => {
    const store = createStore();
    const fetchImpl = vi.fn(async () => jsonResponse([makeNotice()], { "x-verified-at": "2026-07-09T00:00:00Z" }));
    const result = await fetchNotices({ url: "https://example.test/notices", storage: store, fetchImpl });
    expect(result.source).toBe("live");
    expect(result.notices).toHaveLength(1);
    expect(store.data[LKG_KEY]).toBeDefined();
  });

  it("x-data-stale 헤더가 1이면 stale로 표시하고 LKG는 저장하지 않는다", async () => {
    const store = createStore();
    const fetchImpl = vi.fn(async () => jsonResponse([makeNotice()], { "x-data-stale": "1" }));
    const result = await fetchNotices({ url: "https://example.test/notices", storage: store, fetchImpl });
    expect(result.source).toBe("stale");
    expect(store.data[LKG_KEY]).toBeUndefined();
  });

  it("빈 배열 응답은 live·공고 0건(empty)으로 파생한다", async () => {
    const result = await fetchNotices({
      url: "https://example.test/notices",
      storage: createStore(),
      fetchImpl: vi.fn(async () => jsonResponse([])),
    });
    expect(result.source).toBe("live");
    expect(result.notices).toHaveLength(0);
    expect(result.error).toBeNull();
  });

  it("응답은 있으나 활성 공고가 하나도 없으면 오류로 폴백한다", async () => {
    const result = await fetchNotices({
      url: "https://example.test/notices",
      storage: createStore(),
      fetchImpl: vi.fn(async () => jsonResponse([makeNotice({ receiptEnd: "2000-01-01T00:00:00Z" })])),
    });
    expect(result.source).toBe("not-connected");
    expect(result.error).toContain("접수 가능 공고가 없습니다");
  });

  it("fetch 오류 시 캐시가 있으면 stale로 폴백한다", async () => {
    const store = createStore();
    await saveLastKnownNotices(store, { notices: [makeNotice()], verifiedAt: null, savedAt: new Date().toISOString() });
    const result = await fetchNotices({
      url: "https://example.test/notices",
      storage: store,
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }),
    });
    expect(result.source).toBe("stale");
    expect(result.notices).toHaveLength(1);
  });

  it("fetch 오류 시 캐시가 없으면 not-connected(에러 메시지)로 떨어진다", async () => {
    const result = await fetchNotices({
      url: "https://example.test/notices",
      storage: createStore(),
      fetchImpl: vi.fn(async () => {
        throw new Error("network down");
      }),
    });
    expect(result.source).toBe("not-connected");
    expect(result.error).toBe("network down");
  });

  it("HTTP 오류 응답은 상태 코드 메시지로 폴백한다", async () => {
    const result = await fetchNotices({
      url: "https://example.test/notices",
      storage: createStore(),
      fetchImpl: vi.fn(async () => jsonResponse({ error: "bad gateway" }, {}, false, 502)),
    });
    expect(result.source).toBe("not-connected");
    expect(result.error).toBe("bad gateway");
  });
});
