// 공개 청약 데이터 감시기가 오래됨·중복·날짜 역전·통계 불일치를 막는지 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import { assessNoticesHealth } from "./notices-health-core.mjs";

const NOW = Date.parse("2026-08-08T12:00:00.000Z");

function notice(id = "notice-1", overrides = {}) {
  return {
    id,
    houseName: "봄마을",
    receiptStart: "2026-08-10T00:00:00.000Z",
    receiptEnd: "2026-08-20T08:30:00.000Z",
    lastVerifiedAt: "2026-08-08T11:55:00.000Z",
    cancelled: false,
    ...overrides,
  };
}

function headers(count = 1, overrides = {}) {
  return {
    "x-verified-at": "2026-08-08T11:55:00.000Z",
    "x-data-stale": "0",
    "x-collection-stats": JSON.stringify({
      published: count,
      valid: count,
      fetched: count + 10,
      sources: {
        getAPTLttotPblancDetail: { active: count, fetched: count + 10 },
        getOPTLttotPblancDetail: { active: 0, fetched: 1 },
        getRemndrLttotPblancDetail: { active: 0, fetched: 1 },
        getPblPvtRentLttotPblancDetail: { active: 0, fetched: 1 },
        getUrbtyOfctlLttotPblancDetail: { active: 0, fetched: 1 },
      },
    }),
    ...overrides,
  };
}

test("정상 응답은 미래 14일 공고 수와 출처 합계를 함께 반환한다", () => {
  const result = assessNoticesHealth({ data: [notice()], headers: headers(), now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.upcoming14Days, 1);
  assert.equal(result.metrics.sourceActive, 1);
});

test("미래 14일 공고가 사라지면 운영 감시 기준에서 탐지한다", () => {
  const result = assessNoticesHealth({
    data: [notice("later", {
      receiptStart: "2026-09-10T00:00:00.000Z",
      receiptEnd: "2026-09-20T08:30:00.000Z",
    })],
    headers: headers(),
    now: NOW,
    minimumUpcoming14Days: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("앞으로 14일")));
});

test("오래된 stale 정상본과 중복 id를 동시에 탐지한다", () => {
  const result = assessNoticesHealth({
    data: [notice(), notice()],
    headers: headers(2, {
      "x-data-stale": "1",
      "x-verified-at": "2026-08-08T01:00:00.000Z",
    }),
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("중복")));
  assert.ok(result.errors.some((error) => error.includes("stale")));
  assert.ok(result.errors.some((error) => error.includes("갱신되지")));
});

test("접수 날짜 역전과 수집 통계 불일치를 배포 이상으로 본다", () => {
  const result = assessNoticesHealth({
    data: [notice("bad", { receiptStart: "2026-08-21T00:00:00Z" })],
    headers: headers(3, {
      "x-collection-stats": JSON.stringify({
        published: 3,
        valid: 3,
        fetched: 10,
        sources: { official: { active: 2, fetched: 10 } },
      }),
    }),
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("시작일")));
  assert.ok(result.errors.some((error) => error.includes("published")));
  assert.ok(result.errors.some((error) => error.includes("출처별")));
  assert.ok(result.errors.some((error) => error.includes("필수 청약홈 자료 유형")));
});

test("400일 뒤에도 과거 정상본을 최신 자료로 오인하지 않는다", () => {
  const result = assessNoticesHealth({
    data: [notice()],
    headers: headers(),
    now: Date.parse("2027-09-12T12:00:00.000Z"),
    minimumUpcoming14Days: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("이미 마감된")));
  assert.ok(result.errors.some((error) => error.includes("갱신되지")));
});

test("400일 시간 이동 후 새 연도 공식 자료는 정상 통과한다", () => {
  const result = assessNoticesHealth({
    data: [notice("future-year", {
      receiptStart: "2027-09-15T00:00:00.000Z",
      receiptEnd: "2027-09-20T08:30:00.000Z",
      lastVerifiedAt: "2027-09-12T11:55:00.000Z",
    })],
    headers: headers(1, { "x-verified-at": "2027-09-12T11:55:00.000Z" }),
    now: Date.parse("2027-09-12T12:00:00.000Z"),
    minimumUpcoming14Days: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.upcoming14Days, 1);
});
