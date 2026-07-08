// 청약홈 무순위 공고의 도메인 타입 정의.

/** 공고 유형. 청약홈 HOUSE_SECD 04=무순위, 06=취소후재공급. 잔여세대는 이름으로 판별한다. */
export type NoticeType = "무순위" | "잔여세대" | "취소후재공급";

/** 화면에 보여줄 공고 상태. 시각과 플래그에서 파생된다. */
export type NoticeStatus = "예정" | "접수중" | "마감" | "정정" | "취소";

export type NoticeModelSummary = {
  modelNo?: string;
  houseType?: string;
  supplyArea?: string;
  supplyCount?: number;
  specialSupplyCount?: number;
  priceMax?: number;
};

export type Notice = {
  /** 청약홈 주택관리번호+공고번호 기반 고유 ID. */
  id: string;
  manageNo?: string;
  pblancNo?: string;
  type: NoticeType;
  /** 청약홈 원문 주택구분명. */
  officialTypeName?: string;
  /** 고객용 주택 분류. API가 직접 주지 않는 값은 공고문 확인 필요로 둔다. */
  housingCategory?: string;
  sourceOperation?: string;
  /** 단지명. */
  houseName: string;
  /** 시도(공급지역명). */
  region: string;
  regionCode?: string;
  city?: string;
  zipCode?: string;
  address?: string;
  /** 공급 세대수. */
  supplyCount?: number;
  /** 공급금액 하한(만원). */
  priceMin?: number;
  /** 공급금액 상한(만원). */
  priceMax?: number;
  /** 모집공고일 (YYYY-MM-DD). */
  announceDate?: string;
  /** 접수 시작 (UTC ISO). */
  receiptStart: string;
  /** 접수 마감 (UTC ISO). */
  receiptEnd: string;
  /** 당첨자 발표일 (YYYY-MM-DD). */
  winnerDate?: string;
  /** 정정공고 여부. 정정되면 알림을 다시 계산해야 한다. */
  corrected?: boolean;
  /** 취소공고 여부. */
  cancelled?: boolean;
  /** 청약홈 이동 URL. 모집공고 원문 URL과 혼동하지 않는다. */
  applyHomeUrl: string;
  /** 모집공고 원문 URL. */
  noticeUrl?: string;
  officialHomepageUrl?: string;
  businessOwnerName?: string;
  contactPhone?: string;
  moveInMonth?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  newspaperName?: string;
  receiptNote?: string;
  modelSummaries?: NoticeModelSummary[];
  /** 데이터 확인 시각 (UTC ISO). */
  lastVerifiedAt: string;
};
