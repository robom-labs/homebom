// 청약홈 API(15098547) 원시 응답을 Notice로 정규화하는 순수함수.
import type {
  ApplicationEvent,
  ApplicationRegionScope,
  Notice,
  NoticeModelSummary,
  NoticeType,
} from "./types";
import { findComplexProfile } from "./complexProfiles";

/**
 * getRemndrLttotPblancDetail 응답 아이템.
 * 실측 스웨거(stages/37000) 기준 필드. 모르는 필드는 무시한다.
 */
export type RawRemndrItem = {
  HOUSE_MANAGE_NO?: string | number;
  PBLANC_NO?: string | number;
  HOUSE_NM?: string;
  HOUSE_SECD?: string;
  HOUSE_SECD_NM?: string;
  SUBSCRPT_AREA_CODE?: string;
  SUBSCRPT_AREA_CODE_NM?: string;
  HSSPLY_ZIP?: string;
  HSSPLY_ADRES?: string;
  TOT_SUPLY_HSHLDCO?: string | number;
  RCRIT_PBLANC_DE?: string;
  NSPRC_NM?: string;
  SUBSCRPT_RCEPT_BGNDE?: string;
  SUBSCRPT_RCEPT_ENDDE?: string;
  PRZWNER_PRESNATN_DE?: string;
  CNTRCT_CNCLS_BGNDE?: string;
  CNTRCT_CNCLS_ENDDE?: string;
  HMPG_ADRES?: string;
  BSNS_MBY_NM?: string;
  MDHS_TELNO?: string;
  MVN_PREARNGE_YM?: string;
  PBLANC_URL?: string;
  [key: string]: unknown;
};

export type RawAptItem = RawRemndrItem & {
  RCEPT_BGNDE?: string;
  RCEPT_ENDDE?: string;
  SPSPLY_RCEPT_BGNDE?: string;
  SPSPLY_RCEPT_ENDDE?: string;
  GNRL_RNK1_CRSPAREA_RCPTDE?: string;
  GNRL_RNK1_CRSPAREA_ENDDE?: string;
  GNRL_RNK1_ETC_GG_RCPTDE?: string;
  GNRL_RNK1_ETC_GG_ENDDE?: string;
  GNRL_RNK1_ETC_AREA_RCPTDE?: string;
  GNRL_RNK1_ETC_AREA_ENDDE?: string;
  GNRL_RNK2_CRSPAREA_RCPTDE?: string;
  GNRL_RNK2_CRSPAREA_ENDDE?: string;
  GNRL_RNK2_ETC_GG_RCPTDE?: string;
  GNRL_RNK2_ETC_GG_ENDDE?: string;
  GNRL_RNK2_ETC_AREA_RCPTDE?: string;
  GNRL_RNK2_ETC_AREA_ENDDE?: string;
};

export type RawRemndrModelItem = {
  HOUSE_MANAGE_NO?: string | number;
  PBLANC_NO?: string | number;
  MODEL_NO?: string | number;
  HOUSE_TY?: string;
  SUPLY_AR?: string | number;
  SUPLY_HSHLDCO?: string | number;
  SPSPLY_HSHLDCO?: string | number;
  MNYCH_HSHLDCO?: string | number;
  NWWDS_HSHLDCO?: string | number;
  LFE_FRST_HSHLDCO?: string | number;
  OLD_PARNTS_SUPORT_HSHLDCO?: string | number;
  INSTT_RECOMEND_HSHLDCO?: string | number;
  ETC_HSHLDCO?: string | number;
  TRANSR_INSTT_ENFSN_HSHLDCO?: string | number;
  YGMN_HSHLDCO?: string | number;
  NWBB_HSHLDCO?: string | number;
  LTTOT_TOP_AMOUNT?: string | number;
  [key: string]: unknown;
};

/** 접수 시작 기본 시각(KST). 청약홈 무순위 접수는 통상 09:00 시작이다. */
export const DEFAULT_RECEIPT_START_KST = "09:00";
/** 접수 마감 기본 시각(KST). 청약홈 무순위 접수는 통상 17:30 마감이다. */
export const DEFAULT_RECEIPT_END_KST = "17:30";
export const APPLY_HOME_URL = "https://www.applyhome.co.kr";
export const RECEIPT_NOTE =
  "청약홈 신청 가능 시간은 영업일 09:00~17:30 기준입니다. 공고별 정정·별도 조건은 모집공고 원문을 확인하세요.";

/** YYYY-MM-DD(KST 달력 날짜) + HH:mm(KST)을 UTC ISO로 변환한다. */
export function kstDateToUtcIso(dateYmd: string, timeHm: string): string {
  return new Date(`${dateYmd}T${timeHm}:00+09:00`).toISOString();
}

/**
 * 접수일 문자열을 YYYY-MM-DD로 정규화한다.
 * 청약홈이 YYYY-MM-DD 또는 YYYYMMDD로 줄 수 있어 둘 다 받는다.
 * 형식이 맞지 않거나 실제 날짜로 파싱되지 않으면 null을 반환해 해당 공고를 제외시킨다.
 */
export function normalizeYmd(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const ymd = `${year}-${month}-${day}`;
  return Number.isNaN(Date.parse(`${ymd}T00:00:00+09:00`)) ? null : ymd;
}

/** HOUSE_SECD 코드로 공고 유형을 판정한다. 06은 최신 사용자 명칭으로 정규화한다. */
export function resolveNoticeType(raw: RawRemndrItem): NoticeType {
  if (raw.HOUSE_SECD === "06") return "불법행위 재공급";
  const name = `${raw.HOUSE_SECD_NM ?? ""}${raw.HOUSE_NM ?? ""}`;
  if (name.includes("잔여")) return "잔여세대";
  return "무순위";
}

function optionalText(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

export function normalizeExternalUrl(value: unknown): string | undefined {
  const text = optionalText(value);
  if (!text) return undefined;
  if (/[\u0000-\u001F\u007F]/.test(text)) return undefined;
  const candidate = /^www\./i.test(text) ? `https://${text}` : text;
  try {
    const url = new URL(candidate);
    if (!url.hostname || (url.protocol !== "https:" && url.protocol !== "http:")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function stableIdPart(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^0-9a-z가-힣_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildNoticeIdentity(raw: RawRemndrItem, houseName: string, receiptStartYmd: string) {
  const manageNo = String(raw.HOUSE_MANAGE_NO ?? "").trim();
  const pblancNo = String(raw.PBLANC_NO ?? "").trim();
  const legacyId = `${manageNo}-${pblancNo}`;
  if (manageNo && pblancNo) return { id: legacyId, legacyIds: undefined, manageNo, pblancNo };

  const id = manageNo
    ? `manage-${stableIdPart(manageNo)}-${receiptStartYmd}`
    : pblancNo
      ? `pblanc-${stableIdPart(pblancNo)}-${receiptStartYmd}`
      : `notice-${stableIdPart(houseName)}-${normalizeYmd(raw.RCRIT_PBLANC_DE) ?? receiptStartYmd}-${receiptStartYmd}`;

  return {
    id,
    legacyIds: manageNo || pblancNo ? [legacyId] : undefined,
    manageNo,
    pblancNo,
  };
}

function optionalPositiveNumber(value: unknown): number | undefined {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function optionalNonNegativeNumber(value: unknown): number | undefined {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return undefined;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

export function normalizeRemndrModels(items: RawRemndrModelItem[]): NoticeModelSummary[] {
  return items.map((raw) => ({
    modelNo: optionalText(raw.MODEL_NO),
    houseType: optionalText(raw.HOUSE_TY),
    supplyArea: optionalText(raw.SUPLY_AR),
    supplyCount: optionalNonNegativeNumber(raw.SUPLY_HSHLDCO),
    specialSupplyCount: optionalNonNegativeNumber(raw.SPSPLY_HSHLDCO),
    specialSupply: {
      multiChild: optionalNonNegativeNumber(raw.MNYCH_HSHLDCO),
      newlywed: optionalNonNegativeNumber(raw.NWWDS_HSHLDCO),
      firstLife: optionalNonNegativeNumber(raw.LFE_FRST_HSHLDCO),
      oldParent: optionalNonNegativeNumber(raw.OLD_PARNTS_SUPORT_HSHLDCO),
      institution: optionalNonNegativeNumber(raw.INSTT_RECOMEND_HSHLDCO),
      other: optionalNonNegativeNumber(raw.ETC_HSHLDCO),
      transferInstitution: optionalNonNegativeNumber(raw.TRANSR_INSTT_ENFSN_HSHLDCO),
      youth: optionalNonNegativeNumber(raw.YGMN_HSHLDCO),
      newborn: optionalNonNegativeNumber(raw.NWBB_HSHLDCO),
    },
    priceMax: optionalPositiveNumber(raw.LTTOT_TOP_AMOUNT),
  }));
}

function event(
  kind: ApplicationEvent["kind"],
  label: string,
  startValue: unknown,
  endValue?: unknown,
  startTime = DEFAULT_RECEIPT_START_KST,
  endTime = DEFAULT_RECEIPT_END_KST,
  sourceField = "",
  regionScope: ApplicationRegionScope = "not-applicable",
): ApplicationEvent | null {
  const start = normalizeYmd(startValue);
  if (!start) return null;
  const end = normalizeYmd(endValue) ?? start;
  return {
    kind,
    label,
    regionScope,
    start: kstDateToUtcIso(start, startTime),
    end: kstDateToUtcIso(end, endTime),
    confirmed: true,
    sourceField,
  };
}

function identifyEvents(events: ApplicationEvent[], noticeId?: string): ApplicationEvent[] {
  if (!noticeId) return events;
  return events.map((item, index) => ({
    ...item,
    id: `${noticeId}:${item.sourceField || `${item.kind}-${index}`}`,
    noticeId,
  }));
}

function dedupeEvents(events: Array<ApplicationEvent | null>): ApplicationEvent[] {
  const seen = new Set<string>();
  return events
    .filter((item): item is ApplicationEvent => item !== null)
    .filter((item) => {
      const key = `${item.kind}|${item.label}|${item.start}|${item.end ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function buildRemndrEvents(raw: RawRemndrItem, noticeId?: string): ApplicationEvent[] {
  return identifyEvents(dedupeEvents([
    event("announce", "모집공고", raw.RCRIT_PBLANC_DE, raw.RCRIT_PBLANC_DE, "00:00", "23:59", "RCRIT_PBLANC_DE"),
    event("no-priority", "무순위·잔여 접수", raw.SUBSCRPT_RCEPT_BGNDE, raw.SUBSCRPT_RCEPT_ENDDE, "09:00", "17:30", "SUBSCRPT_RCEPT_BGNDE", "all"),
    event("winner", "당첨자 발표", raw.PRZWNER_PRESNATN_DE, raw.PRZWNER_PRESNATN_DE, "00:00", "23:59", "PRZWNER_PRESNATN_DE"),
    event("contract", "계약", raw.CNTRCT_CNCLS_BGNDE, raw.CNTRCT_CNCLS_ENDDE, "09:00", "17:30", "CNTRCT_CNCLS_BGNDE"),
  ]), noticeId);
}

export function buildAptEvents(raw: RawAptItem, noticeId?: string): ApplicationEvent[] {
  return identifyEvents(dedupeEvents([
    event("announce", "모집공고", raw.RCRIT_PBLANC_DE, raw.RCRIT_PBLANC_DE, "00:00", "23:59", "RCRIT_PBLANC_DE"),
    event("receipt", "전체 접수 기간", raw.RCEPT_BGNDE, raw.RCEPT_ENDDE, "09:00", "17:30", "RCEPT_BGNDE", "all"),
    event("special", "특별공급", raw.SPSPLY_RCEPT_BGNDE, raw.SPSPLY_RCEPT_ENDDE, "09:00", "17:30", "SPSPLY_RCEPT_BGNDE", "all"),
    event("rank1", "1순위 해당지역", raw.GNRL_RNK1_CRSPAREA_RCPTDE, raw.GNRL_RNK1_CRSPAREA_ENDDE, "09:00", "17:30", "GNRL_RNK1_CRSPAREA_RCPTDE", "local"),
    event("rank1", "1순위 경기지역", raw.GNRL_RNK1_ETC_GG_RCPTDE, raw.GNRL_RNK1_ETC_GG_ENDDE, "09:00", "17:30", "GNRL_RNK1_ETC_GG_RCPTDE", "gyeonggi"),
    event("rank1", "1순위 기타지역", raw.GNRL_RNK1_ETC_AREA_RCPTDE, raw.GNRL_RNK1_ETC_AREA_ENDDE, "09:00", "17:30", "GNRL_RNK1_ETC_AREA_RCPTDE", "other"),
    event("rank2", "2순위 해당지역", raw.GNRL_RNK2_CRSPAREA_RCPTDE, raw.GNRL_RNK2_CRSPAREA_ENDDE, "09:00", "17:30", "GNRL_RNK2_CRSPAREA_RCPTDE", "local"),
    event("rank2", "2순위 경기지역", raw.GNRL_RNK2_ETC_GG_RCPTDE, raw.GNRL_RNK2_ETC_GG_ENDDE, "09:00", "17:30", "GNRL_RNK2_ETC_GG_RCPTDE", "gyeonggi"),
    event("rank2", "2순위 기타지역", raw.GNRL_RNK2_ETC_AREA_RCPTDE, raw.GNRL_RNK2_ETC_AREA_ENDDE, "09:00", "17:30", "GNRL_RNK2_ETC_AREA_RCPTDE", "other"),
    event("winner", "당첨자 발표", raw.PRZWNER_PRESNATN_DE, raw.PRZWNER_PRESNATN_DE, "00:00", "23:59", "PRZWNER_PRESNATN_DE"),
    event("contract", "계약", raw.CNTRCT_CNCLS_BGNDE, raw.CNTRCT_CNCLS_ENDDE, "09:00", "17:30", "CNTRCT_CNCLS_BGNDE"),
  ]), noticeId);
}

/**
 * 원시 아이템 하나를 Notice로 정규화한다.
 * 접수일이 날짜만 오므로 기본 시각(09:00~17:30 KST)을 적용한다.
 * 필수 정보(단지명·접수기간)가 없으면 null을 반환한다.
 */
export function normalizeRemndrItem(
  raw: RawRemndrItem,
  verifiedAt: string,
  modelItems: RawRemndrModelItem[] = [],
): Notice | null {
  const houseName = raw.HOUSE_NM?.trim();
  const start = normalizeYmd(raw.SUBSCRPT_RCEPT_BGNDE);
  const end = normalizeYmd(raw.SUBSCRPT_RCEPT_ENDDE);
  if (!houseName || !start || !end) return null;

  const identity = buildNoticeIdentity(raw, houseName, start);
  const supply = optionalPositiveNumber(raw.TOT_SUPLY_HSHLDCO);
  const profile = findComplexProfile(houseName, raw.HSSPLY_ADRES?.trim());
  const modelSummaries = normalizeRemndrModels(modelItems);
  const events = buildRemndrEvents(raw, identity.id);
  const prices = modelSummaries
    .map((m) => m.priceMax)
    .filter((price): price is number => typeof price === "number");

  return {
    id: identity.id,
    legacyIds: identity.legacyIds,
    manageNo: identity.manageNo || undefined,
    pblancNo: identity.pblancNo || undefined,
    type: resolveNoticeType(raw),
    officialTypeName: raw.HOUSE_SECD_NM?.trim(),
    housingCategory: "아파트",
    sourceOperation: "getRemndrLttotPblancDetail",
    houseName,
    region: raw.SUBSCRPT_AREA_CODE_NM?.trim() || "전국",
    regionCode: raw.SUBSCRPT_AREA_CODE?.trim(),
    zipCode: raw.HSSPLY_ZIP?.trim(),
    address: raw.HSSPLY_ADRES?.trim(),
    totalHouseholdCount: profile?.totalHouseholdCount,
    totalHouseholdSourceUrl: profile?.sourceUrl,
    totalHouseholdVerifiedAt: profile?.verifiedAt,
    supplyCount: supply,
    priceMin: prices.length > 0 ? Math.min(...prices) : undefined,
    priceMax: prices.length > 0 ? Math.max(...prices) : undefined,
    announceDate: raw.RCRIT_PBLANC_DE,
    receiptStart: kstDateToUtcIso(start, DEFAULT_RECEIPT_START_KST),
    receiptEnd: kstDateToUtcIso(end, DEFAULT_RECEIPT_END_KST),
    winnerDate: raw.PRZWNER_PRESNATN_DE,
    contractStartDate: raw.CNTRCT_CNCLS_BGNDE,
    contractEndDate: raw.CNTRCT_CNCLS_ENDDE,
    officialHomepageUrl: normalizeExternalUrl(raw.HMPG_ADRES),
    businessOwnerName: raw.BSNS_MBY_NM?.trim(),
    contactPhone: raw.MDHS_TELNO?.trim(),
    moveInMonth: raw.MVN_PREARNGE_YM?.trim(),
    newspaperName: raw.NSPRC_NM?.trim(),
    applyHomeUrl: APPLY_HOME_URL,
    noticeUrl: normalizeExternalUrl(raw.PBLANC_URL),
    receiptNote: RECEIPT_NOTE,
    modelSummaries: modelSummaries.length > 0 ? modelSummaries : undefined,
    modelDataStatus: modelSummaries.length > 0 ? "collected" : "not-collected",
    modelDataVerifiedAt: modelSummaries.length > 0 ? verifiedAt : undefined,
    events,
    lastVerifiedAt: verifiedAt,
  };
}

/** APT 일반공급 상세 응답을 특별공급·순위별 접수 일정까지 포함한 Notice로 변환한다. */
export function normalizeAptItem(
  raw: RawAptItem,
  verifiedAt: string,
  modelItems: RawRemndrModelItem[] = [],
): Notice | null {
  const houseName = raw.HOUSE_NM?.trim();
  const draftEvents = buildAptEvents(raw);
  const receiptEvents = draftEvents.filter((item) => ["receipt", "special", "rank1", "rank2"].includes(item.kind));
  if (!houseName || receiptEvents.length === 0) return null;

  const start = receiptEvents.reduce((min, item) => Date.parse(item.start) < Date.parse(min.start) ? item : min);
  const end = receiptEvents.reduce((max, item) => Date.parse(item.end ?? item.start) > Date.parse(max.end ?? max.start) ? item : max);
  const startYmd = normalizeYmd(raw.RCEPT_BGNDE) ?? normalizeYmd(raw.SPSPLY_RCEPT_BGNDE) ?? start.start.slice(0, 10);
  const identity = buildNoticeIdentity(raw, houseName, startYmd);
  const events = buildAptEvents(raw, identity.id);
  const modelSummaries = normalizeRemndrModels(modelItems);
  const prices = modelSummaries.map((item) => item.priceMax).filter((price): price is number => typeof price === "number");

  return {
    id: identity.id,
    legacyIds: identity.legacyIds,
    manageNo: identity.manageNo || undefined,
    pblancNo: identity.pblancNo || undefined,
    type: "일반공급",
    officialTypeName: raw.HOUSE_SECD_NM?.trim(),
    housingCategory: "아파트",
    sourceOperation: "getAPTLttotPblancDetail",
    houseName,
    region: raw.SUBSCRPT_AREA_CODE_NM?.trim() || "전국",
    regionCode: raw.SUBSCRPT_AREA_CODE?.trim(),
    zipCode: raw.HSSPLY_ZIP?.trim(),
    address: raw.HSSPLY_ADRES?.trim(),
    supplyCount: optionalNonNegativeNumber(raw.TOT_SUPLY_HSHLDCO),
    priceMin: prices.length > 0 ? Math.min(...prices) : undefined,
    priceMax: prices.length > 0 ? Math.max(...prices) : undefined,
    announceDate: normalizeYmd(raw.RCRIT_PBLANC_DE) ?? undefined,
    receiptStart: start.start,
    receiptEnd: end.end ?? end.start,
    winnerDate: normalizeYmd(raw.PRZWNER_PRESNATN_DE) ?? undefined,
    contractStartDate: normalizeYmd(raw.CNTRCT_CNCLS_BGNDE) ?? undefined,
    contractEndDate: normalizeYmd(raw.CNTRCT_CNCLS_ENDDE) ?? undefined,
    officialHomepageUrl: normalizeExternalUrl(raw.HMPG_ADRES),
    businessOwnerName: raw.BSNS_MBY_NM?.trim(),
    contactPhone: raw.MDHS_TELNO?.trim(),
    moveInMonth: raw.MVN_PREARNGE_YM?.trim(),
    newspaperName: raw.NSPRC_NM?.trim(),
    applyHomeUrl: APPLY_HOME_URL,
    noticeUrl: normalizeExternalUrl(raw.PBLANC_URL),
    receiptNote: RECEIPT_NOTE,
    modelSummaries: modelSummaries.length > 0 ? modelSummaries : undefined,
    modelDataStatus: modelSummaries.length > 0 ? "collected" : "not-collected",
    modelDataVerifiedAt: modelSummaries.length > 0 ? verifiedAt : undefined,
    events,
    lastVerifiedAt: verifiedAt,
  };
}

/** 아이템 배열을 정규화하고, 정규화 불가 항목은 걸러낸다. */
export function normalizeRemndrItems(items: RawRemndrItem[], verifiedAt: string): Notice[] {
  return items
    .map((raw) => normalizeRemndrItem(raw, verifiedAt))
    .filter((n): n is Notice => n !== null);
}
