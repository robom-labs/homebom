// 공고 일정 변경 때만 저장된 로컬 알림을 다시 맞추는 판정 규칙을 검증한다.
import { describe, expect, it } from "vitest";
import type { NativeNotice } from "../domain/notice";
import { noticeNotificationChanged } from "../domain/notificationRefresh";

function notice(overrides: Partial<NativeNotice> = {}): NativeNotice {
  return {
    id: "notice-1",
    manageNo: "20260001",
    pblancNo: "1",
    title: "봄마을",
    category: "아파트",
    region: "서울특별시",
    address: "서울특별시 봄구",
    supplyCount: 10,
    sourceLabel: "한국부동산원 청약홈",
    officialUrl: "https://www.applyhome.co.kr",
    milestones: [{
      kind: "receipt",
      label: "접수",
      startsAt: "2026-08-10T09:00:00+09:00",
      endsAt: "2026-08-11T18:00:00+09:00",
      notificationAt: "2026-08-09T09:00:00+09:00",
      nextAction: "청약홈에서 확인하세요.",
    }],
    ...overrides,
  };
}

describe("noticeNotificationChanged", () => {
  it("저장 확인본이 없거나 알림 시각이 바뀌면 다시 맞춘다", () => {
    const current = notice();
    expect(noticeNotificationChanged(undefined, current)).toBe(true);
    expect(noticeNotificationChanged(current, notice({
      milestones: [{ ...current.milestones[0]!, notificationAt: "2026-08-09T10:00:00+09:00" }],
    }))).toBe(true);
  });

  it("알림 계약이 같으면 마일스톤 배열 순서가 달라도 다시 예약하지 않는다", () => {
    const current = notice({
      milestones: [
        ...notice().milestones,
        {
          kind: "winner",
          label: "발표",
          startsAt: "2026-08-20T00:00:00+09:00",
          notificationAt: "2026-08-20T09:00:00+09:00",
          nextAction: "청약홈에서 결과를 확인하세요.",
        },
      ],
    });
    expect(noticeNotificationChanged(current, { ...current, milestones: [...current.milestones].reverse() })).toBe(false);
  });
});
