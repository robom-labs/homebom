// 청약홈 API(15098547) 원시 응답을 Notice로 정규화하는 순수함수.
import type { Notice, NoticeModelSummary, NoticeType } from "./types";

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

export type RawRemndrModelItem = {
  HOUSE_MANAGE_NO?: string | number;
  PBLANC_NO?: string | number;
  MODEL_NO?: string | number;
  HOUSE_TY?: string;
  SUPLY_AR?: string | number;
  SUPLY_HSHLDCO?: string | number;
  SPSPLY_HSHLDCO?: string | number;
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

/** HOUSE_SECD 코드로 공고 유형을 판정한다. 04=무순위(잔여세대 포함), 06=취소후재공급. */
export function resolveNoticeType(raw: RawRemndrItem): NoticeType {
  if (raw.HOUSE_SECD === "06") return "취소후재공급";
  const name = `${raw.HOUSE_SECD_NM ?? ""}${raw.HOUSE_NM ?? ""}`;
  if (name.includes("잔여")) return "잔여세대";
  return "무순위";
}

function optionalText(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function optionalUrl(value: unknown): string | undefined {
  const text = optionalText(value);
  if (!text) return undefined;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^www\./i.test(text)) return `https://${text}`;
  return text;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

export function normalizeRemndrModels(items: RawRemndrModelItem[]): NoticeModelSummary[] {
  return items.map((raw) => ({
    modelNo: optionalText(raw.MODEL_NO),
    houseType: optionalText(raw.HOUSE_TY),
    supplyArea: optionalText(raw.SUPLY_AR),
    supplyCount: optionalPositiveNumber(raw.SUPLY_HSHLDCO),
    specialSupplyCount: optionalPositiveNumber(raw.SPSPLY_HSHLDCO),
    priceMax: optionalPositiveNumber(raw.LTTOT_TOP_AMOUNT),
  }));
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
  const start = raw.SUBSCRPT_RCEPT_BGNDE;
  const end = raw.SUBSCRPT_RCEPT_ENDDE;
  if (!houseName || !start || !end) return null;

  const manageNo = String(raw.HOUSE_MANAGE_NO ?? "");
  const pblancNo = String(raw.PBLANC_NO ?? "");
  const supply = optionalPositiveNumber(raw.TOT_SUPLY_HSHLDCO);
  const modelSummaries = normalizeRemndrModels(modelItems);
  const prices = modelSummaries
    .map((m) => m.priceMax)
    .filter((price): price is number => typeof price === "number");

  return {
    id: `${manageNo}-${pblancNo}` || houseName,
    manageNo,
    pblancNo,
    type: resolveNoticeType(raw),
    officialTypeName: raw.HOUSE_SECD_NM?.trim(),
    housingCategory: "APT 잔여세대/무순위",
    sourceOperation: "getRemndrLttotPblancDetail",
    houseName,
    region: raw.SUBSCRPT_AREA_CODE_NM?.trim() || "전국",
    regionCode: raw.SUBSCRPT_AREA_CODE?.trim(),
    zipCode: raw.HSSPLY_ZIP?.trim(),
    address: raw.HSSPLY_ADRES?.trim(),
    supplyCount: supply,
    priceMin: prices.length > 0 ? Math.min(...prices) : undefined,
    priceMax: prices.length > 0 ? Math.max(...prices) : undefined,
    announceDate: raw.RCRIT_PBLANC_DE,
    receiptStart: kstDateToUtcIso(start, DEFAULT_RECEIPT_START_KST),
    receiptEnd: kstDateToUtcIso(end, DEFAULT_RECEIPT_END_KST),
    winnerDate: raw.PRZWNER_PRESNATN_DE,
    contractStartDate: raw.CNTRCT_CNCLS_BGNDE,
    contractEndDate: raw.CNTRCT_CNCLS_ENDDE,
    officialHomepageUrl: optionalUrl(raw.HMPG_ADRES),
    businessOwnerName: raw.BSNS_MBY_NM?.trim(),
    contactPhone: raw.MDHS_TELNO?.trim(),
    moveInMonth: raw.MVN_PREARNGE_YM?.trim(),
    newspaperName: raw.NSPRC_NM?.trim(),
    applyHomeUrl: APPLY_HOME_URL,
    noticeUrl: optionalUrl(raw.PBLANC_URL),
    receiptNote: RECEIPT_NOTE,
    modelSummaries: modelSummaries.length > 0 ? modelSummaries : undefined,
    lastVerifiedAt: verifiedAt,
  };
}

/** 아이템 배열을 정규화하고, 정규화 불가 항목은 걸러낸다. */
export function normalizeRemndrItems(items: RawRemndrItem[], verifiedAt: string): Notice[] {
  return items
    .map((raw) => normalizeRemndrItem(raw, verifiedAt))
    .filter((n): n is Notice => n !== null);
}
