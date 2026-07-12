// 공개 분양자료로 대조한 단지 총세대수 보강 프로필과 안전한 매칭 규칙을 제공한다.

import type { Notice } from "./types";

export type ComplexProfile = {
  houseName: string;
  addressToken: string;
  totalHouseholdCount: number;
  sourceUrl: string;
  verifiedAt: string;
};

const VERIFIED_COMPLEX_PROFILES: readonly ComplexProfile[] = [
  { houseName: "대방역 여의도 더로드캐슬", addressToken: "신길동 449-11", totalHouseholdCount: 46, sourceUrl: "https://www.smilebunyang.com/yeouido-the-road-castle", verifiedAt: "2026-07-12" },
  { houseName: "루원시티 SK 리더스뷰", addressToken: "가정로 437", totalHouseholdCount: 1789, sourceUrl: "https://www.skview.co.kr/html/info/?dp1=const&dp2=constRate&idx=230&month=1&pg=2&year=2022", verifiedAt: "2026-07-12" },
  { houseName: "오정 해모로 스마트시티", addressToken: "오정동 613", totalHouseholdCount: 200, sourceUrl: "https://www.wikitree.co.kr/articles/1138871", verifiedAt: "2026-07-12" },
  { houseName: "힐스테이트 앞산 센트럴", addressToken: "대덕로 162", totalHouseholdCount: 345, sourceUrl: "https://www.mss.go.kr/common/board/Download.do?bcIdx=1029213&cbIdx=253&streFileNm=5b939e30-e4bf-49a6-81ad-f8098cb15fc6.pdf", verifiedAt: "2026-07-12" },
  { houseName: "힐스테이트 시흥더클래스", addressToken: "대야동", totalHouseholdCount: 430, sourceUrl: "https://siheunghillstate.co.kr/", verifiedAt: "2026-07-12" },
  { houseName: "청계 노르웨이숲", addressToken: "황학동", totalHouseholdCount: 404, sourceUrl: "https://www.khba.or.kr/user/isale/isaleInfo.do?busiResuSeq=3&memSeq=2011-0784", verifiedAt: "2026-07-12" },
  { houseName: "수원역 아너스빌 타임원", addressToken: "평동 135-1", totalHouseholdCount: 114, sourceUrl: "https://www.honorsville.co.kr/estate/sale/list", verifiedAt: "2026-07-12" },
  { houseName: "호반써밋 풍무Ⅱ", addressToken: "사우동 527-1", totalHouseholdCount: 961, sourceUrl: "https://www.wikitree.co.kr/articles/1139229", verifiedAt: "2026-07-12" },
];

function normalizeHouseName(value: string): string {
  return value
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function findComplexProfile(houseName?: string, address?: string): ComplexProfile | undefined {
  if (!houseName || !address) return undefined;
  const normalizedName = normalizeHouseName(houseName);
  return VERIFIED_COMPLEX_PROFILES.find(
    (profile) =>
      normalizeHouseName(profile.houseName) === normalizedName && address.includes(profile.addressToken),
  );
}

export function enrichNoticeWithComplexProfile(notice: Notice): Notice {
  if (notice.totalHouseholdCount) return notice;
  const profile = findComplexProfile(notice.houseName, notice.address);
  if (!profile) return notice;
  return {
    ...notice,
    totalHouseholdCount: profile.totalHouseholdCount,
    totalHouseholdSourceUrl: profile.sourceUrl,
    totalHouseholdVerifiedAt: profile.verifiedAt,
  };
}
