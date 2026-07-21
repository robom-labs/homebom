// nativeNoticeFromCore가 존재하는 필드에서만 일정을 만들고 순서·폴백을 지키는지 검증한다.
import { describe, expect, it } from "vitest";
import { kstDateToUtcIso, type Notice } from "@zoopzoopcall/core";
import { nativeNoticeFromCore } from "../domain/noticeMapping";

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
    announceDate: "2026-07-15",
    receiptStart: "2026-07-20T00:00:00+09:00",
    receiptEnd: "2026-07-22T08:30:00+09:00",
    winnerDate: "2026-07-29",
    contractStartDate: "2026-08-10",
    contractEndDate: "2026-08-12",
    applyHomeUrl: "https://www.applyhome.co.kr",
    lastVerifiedAt: "2026-07-09T00:00:00Z",
    ...overrides,
  };
}

describe("nativeNoticeFromCore", () => {
  it("존재하는 모든 날짜 필드에서 4개의 일정을 만들고 startsAt 오름차순으로 정렬한다", () => {
    const result = nativeNoticeFromCore(makeNotice());
    expect(result.milestones.map((milestone) => milestone.kind)).toEqual([
      "announcement",
      "receipt",
      "winner",
      "contract",
    ]);
    const times = result.milestones.map((milestone) => Date.parse(milestone.startsAt));
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1] as number);
    }
  });

  it("공고일 09:00·발표 10:00/알림 09:00 KST와 접수 하루 전 09:00 알림을 정확히 계산한다", () => {
    const result = nativeNoticeFromCore(makeNotice());
    const announcement = result.milestones.find((milestone) => milestone.kind === "announcement");
    const receipt = result.milestones.find((milestone) => milestone.kind === "receipt");
    const winner = result.milestones.find((milestone) => milestone.kind === "winner");
    const contract = result.milestones.find((milestone) => milestone.kind === "contract");

    expect(announcement?.startsAt).toBe(kstDateToUtcIso("2026-07-15", "09:00"));
    expect(receipt?.startsAt).toBe("2026-07-20T00:00:00+09:00");
    expect(receipt?.endsAt).toBe("2026-07-22T08:30:00+09:00");
    // 접수 시작이 KST 7월 20일이므로 알림은 하루 전인 7월 19일 09:00 KST여야 한다.
    expect(receipt?.notificationAt).toBe(kstDateToUtcIso("2026-07-19", "09:00"));
    expect(winner?.startsAt).toBe(kstDateToUtcIso("2026-07-29", "10:00"));
    expect(winner?.notificationAt).toBe(kstDateToUtcIso("2026-07-29", "09:00"));
    expect(contract?.startsAt).toBe(kstDateToUtcIso("2026-08-10", "09:00"));
    expect(contract?.endsAt).toBe(kstDateToUtcIso("2026-08-12", "18:00"));
  });

  it("날짜 필드가 없으면 해당 일정을 만들지 않는다(추측 금지)", () => {
    const result = nativeNoticeFromCore(
      makeNotice({ announceDate: undefined, winnerDate: undefined, contractStartDate: undefined, contractEndDate: undefined }),
    );
    expect(result.milestones.map((milestone) => milestone.kind)).toEqual(["receipt"]);
    const receipt = result.milestones[0];
    expect(receipt?.notificationAt).toBe(kstDateToUtcIso("2026-07-19", "09:00"));
  });

  it("잘못된 형식의 날짜는 정규화 실패로 일정에서 제외한다", () => {
    const result = nativeNoticeFromCore(makeNotice({ winnerDate: "미정", contractStartDate: "0000-00-00" }));
    expect(result.milestones.some((milestone) => milestone.kind === "winner")).toBe(false);
    expect(result.milestones.some((milestone) => milestone.kind === "contract")).toBe(false);
  });

  it("삽입 순서와 상관없이 시간순으로 정렬한다", () => {
    // 공고일을 접수 이후로 둔 비정상 데이터라도 startsAt 기준으로 정렬돼야 한다.
    const result = nativeNoticeFromCore(makeNotice({ announceDate: "2026-08-20" }));
    const kinds = result.milestones.map((milestone) => milestone.kind);
    expect(kinds.indexOf("receipt")).toBeLessThan(kinds.indexOf("announcement"));
  });

  it("빈 식별자·세대수·주소·분류를 안전한 기본값으로 채운다", () => {
    const result = nativeNoticeFromCore(
      makeNotice({ manageNo: undefined, pblancNo: undefined, supplyCount: undefined, address: undefined, housingCategory: undefined, officialTypeName: undefined }),
    );
    expect(result.manageNo).toBe("");
    expect(result.pblancNo).toBe("");
    expect(result.supplyCount).toBe(0);
    expect(result.address).toBe("서울특별시");
    expect(result.category).toBe("무순위");
    expect(result.sourceLabel).toBe("한국부동산원 청약홈");
    expect(result.officialUrl).toBe("https://www.applyhome.co.kr");
  });

  it("분류는 housingCategory → officialTypeName → 유형명 순으로 고른다", () => {
    expect(nativeNoticeFromCore(makeNotice({ housingCategory: "아파트" })).category).toBe("아파트");
    expect(nativeNoticeFromCore(makeNotice({ housingCategory: undefined, officialTypeName: "민영 무순위" })).category).toBe("민영 무순위");
  });
});
