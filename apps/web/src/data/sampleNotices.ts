// 실서비스 키 연결 전 데모용 샘플 공고 생성기. 모든 시각은 anchor(로드 시점) 기준 상대 배치라 상태 변화를 그대로 볼 수 있다.
import type { Notice } from "@zoopzoopcall/core";
import { kstDateKey } from "@zoopzoopcall/core";

const HOUR = 3600_000;
const MIN = 60_000;

const APPLYHOME = "https://www.applyhome.co.kr";

type Spec = {
  id: string;
  type: Notice["type"];
  houseName: string;
  region: string;
  address: string;
  supplyCount: number;
  priceMin?: number;
  priceMax?: number;
  startOffsetMs: number;
  endOffsetMs: number;
  corrected?: boolean;
  cancelled?: boolean;
};

const SPECS: Spec[] = [
  {
    id: "sample-01",
    type: "무순위",
    houseName: "세종 리버파크 어울림",
    region: "세종",
    address: "세종특별자치시 나성동",
    supplyCount: 5,
    priceMin: 32000,
    priceMax: 41000,
    startOffsetMs: 3 * MIN,
    endOffsetMs: 8 * HOUR,
  },
  {
    id: "sample-02",
    type: "무순위",
    houseName: "한강뷰 센트럴 클래스",
    region: "서울",
    address: "서울특별시 동작구 흑석동",
    supplyCount: 2,
    priceMin: 84000,
    priceMax: 91000,
    startOffsetMs: -2 * HOUR,
    endOffsetMs: 4 * HOUR,
  },
  {
    id: "sample-03",
    type: "잔여세대",
    houseName: "광교 레이크 포레",
    region: "경기",
    address: "경기도 수원시 영통구 이의동",
    supplyCount: 18,
    priceMin: 45000,
    priceMax: 62000,
    startOffsetMs: -5 * HOUR,
    endOffsetMs: 27 * HOUR,
  },
  {
    id: "sample-04",
    type: "무순위",
    houseName: "해운대 마린 스카이",
    region: "부산",
    address: "부산광역시 해운대구 우동",
    supplyCount: 3,
    priceMin: 58000,
    priceMax: 67000,
    startOffsetMs: 26 * HOUR,
    endOffsetMs: 34 * HOUR,
  },
  {
    id: "sample-05",
    type: "취소후재공급",
    houseName: "동탄 센트럴 파크뷰",
    region: "경기",
    address: "경기도 화성시 오산동",
    supplyCount: 1,
    priceMin: 38000,
    startOffsetMs: 49 * HOUR,
    endOffsetMs: 57 * HOUR,
  },
  {
    id: "sample-06",
    type: "무순위",
    houseName: "청라 힐즈 에듀포레",
    region: "인천",
    address: "인천광역시 서구 청라동",
    supplyCount: 7,
    priceMin: 41000,
    priceMax: 52000,
    startOffsetMs: 72 * HOUR,
    endOffsetMs: 80 * HOUR,
  },
  {
    id: "sample-07",
    type: "무순위",
    houseName: "수성 레이크 팰리스",
    region: "대구",
    address: "대구광역시 수성구 두산동",
    supplyCount: 4,
    priceMin: 47000,
    priceMax: 55000,
    startOffsetMs: 26 * HOUR,
    endOffsetMs: 34 * HOUR,
    corrected: true,
  },
  {
    id: "sample-08",
    type: "무순위",
    houseName: "둔산 그린 어반",
    region: "대전",
    address: "대전광역시 서구 둔산동",
    supplyCount: 6,
    priceMin: 36000,
    priceMax: 44000,
    startOffsetMs: 24 * HOUR,
    endOffsetMs: 32 * HOUR,
    cancelled: true,
  },
  {
    id: "sample-09",
    type: "무순위",
    houseName: "마곡 리버사이드",
    region: "서울",
    address: "서울특별시 강서구 마곡동",
    supplyCount: 1,
    priceMin: 79000,
    startOffsetMs: -30 * HOUR,
    endOffsetMs: -22 * HOUR,
  },
  {
    id: "sample-10",
    type: "잔여세대",
    houseName: "판교 밸리 하임",
    region: "경기",
    address: "경기도 성남시 분당구 판교동",
    supplyCount: 9,
    priceMin: 52000,
    priceMax: 68000,
    startOffsetMs: -72 * HOUR,
    endOffsetMs: -64 * HOUR,
  },
];

/** anchor(ms) 기준으로 샘플 공고 목록을 만든다. 같은 anchor면 항상 같은 결과다. */
export function generateSampleNotices(anchor: number): Notice[] {
  return SPECS.map((s) => {
    const start = anchor + s.startOffsetMs;
    const end = anchor + s.endOffsetMs;
    return {
      id: s.id,
      type: s.type,
      houseName: s.houseName,
      region: s.region,
      address: s.address,
      supplyCount: s.supplyCount,
      priceMin: s.priceMin,
      priceMax: s.priceMax,
      announceDate: kstDateKey(anchor - 5 * 86400_000),
      receiptStart: new Date(start).toISOString(),
      receiptEnd: new Date(end).toISOString(),
      winnerDate: kstDateKey(end + 5 * 86400_000),
      corrected: s.corrected,
      cancelled: s.cancelled,
      applyHomeUrl: APPLYHOME,
      lastVerifiedAt: new Date(anchor).toISOString(),
    };
  });
}
