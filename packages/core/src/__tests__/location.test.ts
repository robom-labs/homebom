// 지도 검색 후보의 정리 순서와 외부 링크 인코딩을 검증한다.
import { describe, expect, it } from "vitest";
import { addressSearchCandidates, kakaoMapSearchUrl, naverMapSearchUrl } from "../notice/location";

describe("addressSearchCandidates", () => {
  it("괄호 속 지번과 부가문구를 제거한 후보, 단지명 후보를 중복 없이 만든다", () => {
    const candidates = addressSearchCandidates(
      "김포 풍무역세권 C5블록 (경기도 김포시 사우동 527-1 일원)",
      "호반써밋 풍무Ⅱ",
      "경기",
    );
    expect(candidates).toContain("경기도 김포시 사우동 527-1 일원");
    expect(candidates).toContain("김포 풍무역세권 C5블록");
    expect(candidates).toContain("호반써밋 풍무Ⅱ 경기");
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});

describe("map links", () => {
  it("검색어를 URL 경로에 안전하게 인코딩한다", () => {
    expect(naverMapSearchUrl("서울 강남구")).toContain(encodeURIComponent("서울 강남구"));
    expect(kakaoMapSearchUrl("서울 강남구")).toContain(encodeURIComponent("서울 강남구"));
  });
});
