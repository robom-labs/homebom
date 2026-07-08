// 청약홈 API(15098547) 원시 응답을 Notice로 정규화하는 순수함수.
import type { Notice, NoticeType } from "./types";

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
  SUBSCRPT_AREA_CODE_NM?: string;
  HSSPLY_ADRES?: string;
  TOT_SUPLY_HSHLDCO?: string | number;
  RCRIT_PBLANC_DE?: string;
  SUBSCRPT_RCEPT_BGNDE?: string;
  SUBSCRPT_RCEPT_ENDDE?: string;
  PRZWNER_PRESNATN_DE?: string;
  PBLANC_URL?: string;
  [key: string]: unknown;
};

/** 접수 시작 기본 시각(KST). 청약홈 무순위 접수는 통상 09:00 시작이다. */
export const DEFAULT_RECEIPT_START_KST = "09:00";
/** 접수 마감 기본 시각(KST). 청약홈 무순위 접수는 통상 17:30 마감이다. */
export const DEFAULT_RECEIPT_END_KST = "17:30";

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

/**
 * 원시 아이템 하나를 Notice로 정규화한다.
 * 접수일이 날짜만 오므로 기본 시각(09:00~17:30 KST)을 적용한다.
 * 필수 정보(단지명·접수기간)가 없으면 null을 반환한다.
 */
export function normalizeRemndrItem(raw: RawRemndrItem, verifiedAt: string): Notice | null {
  const houseName = raw.HOUSE_NM?.trim();
  const start = raw.SUBSCRPT_RCEPT_BGNDE;
  const end = raw.SUBSCRPT_RCEPT_ENDDE;
  if (!houseName || !start || !end) return null;

  const manageNo = String(raw.HOUSE_MANAGE_NO ?? "");
  const pblancNo = String(raw.PBLANC_NO ?? "");
  const supply = Number(raw.TOT_SUPLY_HSHLDCO);

  return {
    id: `${manageNo}-${pblancNo}` || houseName,
    type: resolveNoticeType(raw),
    houseName,
    region: raw.SUBSCRPT_AREA_CODE_NM?.trim() || "전국",
    address: raw.HSSPLY_ADRES?.trim(),
    supplyCount: Number.isFinite(supply) && supply > 0 ? supply : undefined,
    announceDate: raw.RCRIT_PBLANC_DE,
    receiptStart: kstDateToUtcIso(start, DEFAULT_RECEIPT_START_KST),
    receiptEnd: kstDateToUtcIso(end, DEFAULT_RECEIPT_END_KST),
    winnerDate: raw.PRZWNER_PRESNATN_DE,
    applyHomeUrl: raw.PBLANC_URL?.trim() || "https://www.applyhome.co.kr",
    lastVerifiedAt: verifiedAt,
  };
}

/** 아이템 배열을 정규화하고, 정규화 불가 항목은 걸러낸다. */
export function normalizeRemndrItems(items: RawRemndrItem[], verifiedAt: string): Notice[] {
  return items
    .map((raw) => normalizeRemndrItem(raw, verifiedAt))
    .filter((n): n is Notice => n !== null);
}
