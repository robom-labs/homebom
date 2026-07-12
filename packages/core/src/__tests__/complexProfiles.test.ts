// 총세대수 보강은 단지명과 주소가 함께 맞을 때만 적용되는지 검증한다.
import { describe, expect, it } from "vitest";
import { enrichNoticeWithComplexProfile, findComplexProfile } from "../notice/complexProfiles";
import type { Notice } from "../notice/types";

const notice = (overrides: Partial<Notice> = {}): Notice => ({
  id: "2026930023-2026930023",
  type: "무순위",
  houseName: "루원시티 SK 리더스뷰",
  region: "인천",
  address: "인천광역시 서해구 가정로 437(루원시티 SK 리더스뷰)",
  receiptStart: "2026-07-13T00:00:00.000Z",
  receiptEnd: "2026-07-13T08:30:00.000Z",
  applyHomeUrl: "https://www.applyhome.co.kr",
  lastVerifiedAt: "2026-07-12T00:00:00.000Z",
  ...overrides,
});

describe("findComplexProfile", () => {
  it("차수 표기가 붙어도 단지명과 주소가 모두 맞으면 총세대수를 찾는다", () => {
    const profile = findComplexProfile("루원시티 SK 리더스뷰(2차)", "인천광역시 서해구 가정로 437");
    expect(profile?.totalHouseholdCount).toBe(1789);
  });

  it("같은 이름이라도 주소가 다르면 잘못 보강하지 않는다", () => {
    expect(findComplexProfile("루원시티 SK 리더스뷰", "인천광역시 서해구 가정로 999")).toBeUndefined();
  });
});

describe("enrichNoticeWithComplexProfile", () => {
  it("원본에 없던 총세대수와 출처를 보강한다", () => {
    const enriched = enrichNoticeWithComplexProfile(notice());
    expect(enriched.totalHouseholdCount).toBe(1789);
    expect(enriched.totalHouseholdSourceUrl).toContain("skview.co.kr");
  });

  it("서버가 제공한 총세대수는 덮어쓰지 않는다", () => {
    expect(enrichNoticeWithComplexProfile(notice({ totalHouseholdCount: 1800 })).totalHouseholdCount).toBe(1800);
  });
});
