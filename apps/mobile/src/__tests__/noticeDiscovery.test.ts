// 접수 시기 필터와 검색, 알림 딥링크 복원 규칙을 한국시간 경계에서 검증한다.
import { describe, expect, it } from "vitest";
import type { NativeNotice } from "../domain/notice";
import {
  bringNoticeToFront,
  countNoticeDateFilters,
  countUpcomingReceiptStarts,
  discoverNotices,
  noticeDateBucket,
  noticeIdFromAppUrl,
  noticeIdFromNotificationData,
} from "../domain/noticeDiscovery";

function notice(
  id: string,
  startsAt: string,
  endsAt: string,
  overrides: Partial<NativeNotice> = {},
): NativeNotice {
  return {
    id,
    manageNo: id,
    pblancNo: "1",
    title: `${id} 봄마을`,
    category: "아파트",
    region: "서울특별시",
    address: "서울특별시 봄구",
    supplyCount: 10,
    sourceLabel: "한국부동산원 청약홈",
    officialUrl: "https://www.applyhome.co.kr",
    milestones: [{
      kind: "receipt",
      label: "접수",
      startsAt,
      endsAt,
      nextAction: "청약홈에서 확인하세요.",
    }],
    ...overrides,
  };
}

describe("noticeDiscovery", () => {
  const now = Date.parse("2026-08-08T14:30:00+09:00");
  const open = notice("open", "2026-08-08T09:00:00+09:00", "2026-08-09T18:00:00+09:00");
  const week = notice("week", "2026-08-15T23:59:00+09:00", "2026-08-15T23:59:00+09:00");
  const later = notice("later", "2026-08-16T00:00:00+09:00", "2026-08-16T18:00:00+09:00");

  it("KST 오늘부터 7개 달력 날짜와 8일 이후 경계를 나눈다", () => {
    expect(noticeDateBucket(open, now)).toBe("open");
    expect(noticeDateBucket(week, now)).toBe("week");
    expect(noticeDateBucket(later, now)).toBe("later");
    expect(countNoticeDateFilters([open, week, later], now)).toEqual({
      all: 3,
      open: 1,
      week: 1,
      later: 1,
    });
    expect(countUpcomingReceiptStarts([open, week, later], 14, now)).toBe(2);
    expect(countUpcomingReceiptStarts([open, week, later], 7, now)).toBe(1);
  });

  it("공고명·지역·주소·유형을 검색하고 선택한 시기만 반환한다", () => {
    const busan = notice("busan", "2026-08-14T10:00:00+09:00", "2026-08-14T18:00:00+09:00", {
      title: "해운대 행복주택",
      category: "공공임대",
      region: "부산광역시",
      address: "부산광역시 해운대구",
    });
    expect(discoverNotices([open, busan], { filter: "week", query: "해운대", now })).toEqual([busan]);
    expect(discoverNotices([open, busan], { filter: "all", query: "공공 임대", now })).toEqual([busan]);
  });

  it("알림 대상 공고를 목록 맨 앞으로 옮기고 URL과 알림 데이터를 안전하게 읽는다", () => {
    expect(bringNoticeToFront([open, week, later], "later").map((value) => value.id)).toEqual([
      "later",
      "open",
      "week",
    ]);
    expect(noticeIdFromAppUrl("homebom://notice/20260001%2D1")).toBe("20260001-1");
    expect(noticeIdFromAppUrl("https://robom.kr/get/homebom")).toBeNull();
    expect(noticeIdFromNotificationData({ noticeId: " 20260001-1 " })).toBe("20260001-1");
    expect(noticeIdFromNotificationData([])).toBeNull();
  });
});
