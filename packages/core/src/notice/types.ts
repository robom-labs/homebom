// 청약홈 무순위 공고의 도메인 타입 정의.

/** 공고 유형. `취소후재공급`은 기존 저장 스냅샷을 읽기 위한 호환 별칭이다. */
export type NoticeType =
  | "일반공급"
  | "무순위"
  | "잔여세대"
  | "임의공급"
  | "불법행위 재공급"
  | "취소후재공급";

/** 화면에 보여줄 공고 상태. 시각과 플래그에서 파생된다. */
export type NoticeStatus = "예정" | "접수중" | "마감" | "정정" | "취소";

export type NoticeModelSummary = {
  modelNo?: string;
  houseType?: string;
  supplyArea?: string;
  supplyCount?: number;
  specialSupplyCount?: number;
  specialSupply?: {
    multiChild?: number;
    newlywed?: number;
    firstLife?: number;
    oldParent?: number;
    institution?: number;
    other?: number;
    transferInstitution?: number;
    youth?: number;
    newborn?: number;
  };
  priceMax?: number;
};

/** 공고문에서만 확인되는 의사결정 정보. 값이 없으면 화면에서 추측하지 않는다. */
export type NoticeDecisionSupport = {
  subscriptionAccount?: string;
  selectionMethod?: string;
  applicantQualification?: string;
  transferRestriction?: string;
  residenceRequirement?: string;
  rewinningRestriction?: string;
  constructionCompanyName?: string;
  paymentSchedule?: Array<{
    label: string;
    ratio?: string;
    amountManwon?: number;
    timing?: string;
  }>;
  costWarning?: string;
  source?: "notice-html" | "notice-pdf" | "official-page" | "public-agency";
  verifiedAt?: string;
};

/** 국토부 실거래 원자료를 청약봄이 계산한 가격 비교 신호. 저신뢰 값은 노출하지 않는다. */
export type NoticePriceSignal = {
  percentBelowMedian: number;
  confidence: "high" | "low";
  source: "molit-trade";
  sourceLabel: string;
  comparisonAreaLabel: string;
  sampleMonths: number;
  verifiedAt: string;
};

export type NoticeSourceType =
  | "applyhome-api"
  | "notice-html"
  | "notice-pdf"
  | "official-page"
  | "public-agency"
  | "molit-trade";

export type NoticeVerificationStatus =
  | "verified"
  | "single-official-source"
  | "conflict"
  | "not-provided"
  | "retrying";

/** 공개 필드가 어느 공식 자료에서 언제 확인됐는지 보존한다. */
export type NoticeFieldProvenance = {
  sourceType: NoticeSourceType;
  sourceUrl?: string;
  fetchedAt: string;
  documentHash?: string;
  revision?: string;
  status: NoticeVerificationStatus;
};

export type ApplicationEventKind =
  | "announce"
  | "receipt"
  | "special"
  | "rank1"
  | "rank2"
  | "no-priority"
  | "winner"
  | "contract";

export type ApplicationRegionScope = "local" | "gyeonggi" | "other" | "all" | "not-applicable";

/** 공고별 모집공고·접수·발표·계약 일정을 한 달력에서 보여주기 위한 표준 일정. */
export type ApplicationEvent = {
  /** 새 데이터는 noticeId+sourceField 기반 안정 ID를 갖고, 과거 저장값은 adapter가 보강한다. */
  id?: string;
  noticeId?: string;
  kind: ApplicationEventKind;
  label: string;
  regionScope?: ApplicationRegionScope;
  /** KST 날짜·시각을 변환한 UTC ISO. */
  start: string;
  /** 기간 일정일 때만 제공하는 UTC ISO. */
  end?: string;
  /** `official`만 시각이 공식 자료에서 확인된 값이다. */
  timeSource?: "official" | "date-only" | "reference-rule";
  startTimeConfirmed?: boolean;
  endTimeConfirmed?: boolean;
  confirmed?: boolean;
  sourceField?: string;
};

export type Notice = {
  /** 청약홈 번호 또는 공고 내용으로 만든 안정 ID. */
  id: string;
  /** 안정 ID 도입 전 사용하던 ID. 기존 알림 저장값을 한 번 마이그레이션할 때만 쓴다. */
  legacyIds?: string[];
  manageNo?: string;
  pblancNo?: string;
  type: NoticeType;
  /** 청약홈 원문 주택구분명. */
  officialTypeName?: string;
  /** 고객용 주택 분류. 공식 자료에서 검증되지 않은 값은 노출하지 않는다. */
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
  /** 단지 전체 세대수. 현재 청약홈 잔여세대 API에는 없어 별도 보강 데이터가 있을 때만 채운다. */
  totalHouseholdCount?: number;
  /** 단지 전체 세대수의 공개 확인 출처. */
  totalHouseholdSourceUrl?: string;
  /** 총세대수 공개자료를 마지막으로 대조한 날짜. */
  totalHouseholdVerifiedAt?: string;
  /** 이번 공고의 모집 세대수. */
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
  /** 활성 피드에서 사라졌지만 접수 종료 전인 구독 스냅샷 표시(취소·정정 후보). 알림을 멈춘다. */
  missingFromFeed?: boolean;
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
  /** 주택형 보강 데이터의 수집 상태. `not-collected`는 공식값 0과 다르다. */
  modelDataStatus?: "collected" | "not-collected" | "retrying";
  modelDataVerifiedAt?: string;
  latitude?: number;
  longitude?: number;
  geocodeQuery?: string;
  geocodeStatus?: "matched" | "not-found" | "not-configured";
  /** 일반공급의 특별공급·1순위·2순위와 발표·계약까지 포함한 전체 일정. */
  events?: ApplicationEvent[];
  /** 데이터 확인 시각 (UTC ISO). */
  lastVerifiedAt: string;
  /** 공식 공고문을 구조화해 검증한 값. 없는 필드는 사용자 화면에서 숨긴다. */
  decisionSupport?: NoticeDecisionSupport;
  /** 국토부 실거래 기반 파생값. 충분한 표본과 고신뢰일 때만 화면에 표시한다. */
  priceSignal?: NoticePriceSignal;
  /** 필드별 공식 출처와 검증 상태. 충돌 필드는 값 대신 conflict 상태만 남긴다. */
  fieldProvenance?: Record<string, NoticeFieldProvenance>;
  /** 서로 다른 수집 단계의 실제 확인 시각. */
  verification?: {
    noticeApiFetchedAt?: string;
    modelApiFetchedAt?: string;
    documentFetchedAt?: string;
    publishedSnapshotAt?: string;
  };
};
