// 네이티브 관심 공고 저장값의 구버전 호환과 손상 데이터 격리를 검증한다.
import { describe, expect, it } from "vitest";
import { normalizeInterestRecord } from "../storage/interests";

const NOTICE_ID = "2026000123-1";

function makeStoredNotice(): Record<string, unknown> {
  return {
    id: NOTICE_ID,
    manageNo: "2026000123",
    pblancNo: "1",
    title: "테스트 봄마을 1단지",
    category: "무순위",
    region: "서울특별시",
    address: "서울특별시 테스트구 테스트로 1",
    supplyCount: 3,
    sourceLabel: "청약홈",
    officialUrl: "https://www.applyhome.co.kr",
    milestones: [
      {
        kind: "receipt",
        label: "접수",
        startsAt: "2026-08-10T00:00:00+09:00",
        endsAt: "2026-08-11T23:59:59+09:00",
        nextAction: "청약홈에서 신청하세요.",
      },
    ],
  };
}

describe("normalizeInterestRecord", () => {
  it("정상 저장값은 공고 스냅샷과 알림 ID를 복원한다", () => {
    const result = normalizeInterestRecord({
      noticeId: NOTICE_ID,
      notificationIds: ["notification-1"],
      savedAt: "2026-08-08T00:00:00.000Z",
      notice: makeStoredNotice(),
    }, NOTICE_ID);

    expect(result?.notice?.title).toBe("테스트 봄마을 1단지");
    expect(result?.notificationIds).toEqual(["notification-1"]);
  });

  it("손상된 공고 스냅샷은 제외하고 관심 상태와 정상 알림 ID는 보존한다", () => {
    const result = normalizeInterestRecord({
      noticeId: NOTICE_ID,
      notificationIds: ["notification-1", 42, ""],
      savedAt: "broken-date",
      notice: { ...makeStoredNotice(), milestones: [{ kind: "receipt" }] },
    }, NOTICE_ID);

    expect(result).toBeDefined();
    expect(result?.notice).toBeUndefined();
    expect(result?.notificationIds).toEqual(["notification-1"]);
    expect(result?.savedAt).toBe("1970-01-01T00:00:00.000Z");
  });

  it("저장 키와 noticeId가 다르면 다른 공고의 관심 상태로 복원하지 않는다", () => {
    expect(normalizeInterestRecord({
      noticeId: "other-notice",
      notificationIds: [],
      savedAt: "2026-08-08T00:00:00.000Z",
    }, NOTICE_ID)).toBeUndefined();
  });
});
