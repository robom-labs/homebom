// 구독 스냅샷과 활성 피드 대조(취소 후보 표시) 순수함수 테스트.
import { describe, expect, it } from "vitest";
import { markSnapshotsMissingFromFeed } from "../notice/snapshotSync";
import type { Notice } from "../notice/types";

const notice = (overrides: Partial<Notice> & { id: string }): Notice => ({
  type: "무순위",
  houseName: `단지 ${overrides.id}`,
  region: "서울",
  receiptStart: "2026-07-20T00:00:00.000Z",
  receiptEnd: "2026-07-21T08:30:00.000Z",
  applyHomeUrl: "https://www.applyhome.co.kr",
  lastVerifiedAt: "2026-07-10T00:00:00.000Z",
  ...overrides,
});

const NOW = Date.parse("2026-07-16T00:00:00Z");

describe("markSnapshotsMissingFromFeed", () => {
  it("접수 종료 전인데 피드에 없는 구독 공고를 취소 후보로 표시한다", () => {
    const snapshot = notice({ id: "N1" });
    const result = markSnapshotsMissingFromFeed([], { N1: snapshot }, NOW);

    expect(result.changed).toBe(true);
    expect(result.snapshots.N1.missingFromFeed).toBe(true);
    // 원본 스냅샷은 변형하지 않는다.
    expect(snapshot.missingFromFeed).toBeUndefined();
  });

  it("피드가 cancelled 톰스톤을 주면 마찬가지로 취소 후보로 표시한다", () => {
    const snapshot = notice({ id: "N2" });
    const tombstone = notice({ id: "N2", cancelled: true });
    const result = markSnapshotsMissingFromFeed([tombstone], { N2: snapshot }, NOW);

    expect(result.changed).toBe(true);
    expect(result.snapshots.N2.missingFromFeed).toBe(true);
  });

  it("접수 종료가 이미 지난 스냅샷은 건드리지 않는다(만료 정리 흐름 담당)", () => {
    const expired = notice({ id: "N3", receiptStart: "2026-07-01T00:00:00.000Z", receiptEnd: "2026-07-02T08:30:00.000Z" });
    const result = markSnapshotsMissingFromFeed([], { N3: expired }, NOW);

    expect(result.changed).toBe(false);
    expect(result.snapshots.N3.missingFromFeed).toBeUndefined();
  });

  it("피드에 살아 있는 공고는 표시하지 않는다", () => {
    const snapshot = notice({ id: "N4" });
    const result = markSnapshotsMissingFromFeed([notice({ id: "N4" })], { N4: snapshot }, NOW);

    expect(result.changed).toBe(false);
    expect(result.snapshots.N4.missingFromFeed).toBeUndefined();
  });

  it("피드에 다시 나타나면 취소 후보 표시를 해제해 알림이 재개되게 한다", () => {
    const flagged = notice({ id: "N5", missingFromFeed: true });
    const result = markSnapshotsMissingFromFeed([notice({ id: "N5" })], { N5: flagged }, NOW);

    expect(result.changed).toBe(true);
    expect(result.snapshots.N5.missingFromFeed).toBeUndefined();
    expect("missingFromFeed" in result.snapshots.N5).toBe(false);
  });

  it("이미 표시된 스냅샷이 계속 피드에 없으면 변경 없음으로 끝난다", () => {
    const flagged = notice({ id: "N6", missingFromFeed: true });
    const result = markSnapshotsMissingFromFeed([], { N6: flagged }, NOW);

    expect(result.changed).toBe(false);
    expect(result.snapshots.N6.missingFromFeed).toBe(true);
  });

  it("receiptEnd가 깨진 스냅샷은 오탐하지 않도록 건드리지 않는다", () => {
    const broken = notice({ id: "N7", receiptEnd: "invalid" });
    const result = markSnapshotsMissingFromFeed([], { N7: broken }, NOW);

    expect(result.changed).toBe(false);
    expect(result.snapshots.N7.missingFromFeed).toBeUndefined();
  });
});
