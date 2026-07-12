// 주택 형태와 총·모집 세대수 문구가 원본 데이터 의미를 지키는지 검증한다.
import { describe, expect, it } from "vitest";
import {
  formatHouseholdSummary,
  formatHouseTypeLabel,
  inferHousingCategory,
} from "../notice/housing";

describe("inferHousingCategory", () => {
  it("잔여세대 API 공고는 아파트로 분류한다", () => {
    expect(inferHousingCategory(undefined, "getRemndrLttotPblancDetail")).toBe("아파트");
  });

  it("명시된 분류를 우선하고 알 수 없으면 확인 문구를 반환한다", () => {
    expect(inferHousingCategory("주상복합", "getRemndrLttotPblancDetail")).toBe("주상복합");
    expect(inferHousingCategory()).toBe("주택 형태 확인");
  });
});

describe("formatHouseTypeLabel", () => {
  it("원시 주택형의 앞자리와 불필요한 0을 정리한다", () => {
    expect(formatHouseTypeLabel("084.6013D")).toBe("84.6013D형");
    expect(formatHouseTypeLabel("024.9100")).toBe("24.91형");
    expect(formatHouseTypeLabel("084.0000A")).toBe("84A형");
  });

  it("빈 값은 표시하지 않는다", () => {
    expect(formatHouseTypeLabel(undefined)).toBeNull();
    expect(formatHouseTypeLabel("  ")).toBeNull();
  });
});

describe("formatHouseholdSummary", () => {
  it("총세대수와 이번 모집 세대수를 함께 구분한다", () => {
    expect(formatHouseholdSummary(1000, 13)).toBe("총 1,000세대 중 이번 모집 13세대");
  });

  it("총세대수 결측을 꾸며내지 않고 공고문 확인으로 알린다", () => {
    expect(formatHouseholdSummary(undefined, 13)).toBe("총 세대수 공고문 확인 · 이번 모집 13세대");
    expect(formatHouseholdSummary()).toBe("전체·모집 세대수 공고문 확인");
  });
});
