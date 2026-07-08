// 청약홈 API 원시 응답 정규화 테스트.
import { describe, expect, it } from "vitest";
import {
  kstDateToUtcIso,
  normalizeRemndrItem,
  normalizeRemndrItems,
  resolveNoticeType,
} from "../notice/normalize";

const VERIFIED = "2026-07-08T00:00:00.000Z";

const raw = {
  HOUSE_MANAGE_NO: 2026000001,
  PBLANC_NO: 1,
  HOUSE_NM: "행복마을 어울림",
  HOUSE_SECD: "04",
  HOUSE_SECD_NM: "무순위",
  SUBSCRPT_AREA_CODE_NM: "경기",
  HSSPLY_ADRES: "경기도 수원시 팔달구",
  TOT_SUPLY_HSHLDCO: "12",
  RCRIT_PBLANC_DE: "2026-07-01",
  SUBSCRPT_RCEPT_BGNDE: "2026-07-10",
  SUBSCRPT_RCEPT_ENDDE: "2026-07-10",
  PRZWNER_PRESNATN_DE: "2026-07-15",
  PBLANC_URL: "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2026000001",
};

describe("kstDateToUtcIso", () => {
  it("KST 날짜+시각을 UTC ISO로 변환한다", () => {
    expect(kstDateToUtcIso("2026-07-10", "09:00")).toBe("2026-07-10T00:00:00.000Z");
    expect(kstDateToUtcIso("2026-07-10", "17:30")).toBe("2026-07-10T08:30:00.000Z");
  });
});

describe("resolveNoticeType", () => {
  it("HOUSE_SECD 06은 취소후재공급", () => {
    expect(resolveNoticeType({ HOUSE_SECD: "06" })).toBe("취소후재공급");
  });

  it("이름에 잔여가 들어가면 잔여세대", () => {
    expect(resolveNoticeType({ HOUSE_SECD: "04", HOUSE_SECD_NM: "무순위/잔여세대" })).toBe("잔여세대");
  });

  it("기본은 무순위", () => {
    expect(resolveNoticeType({ HOUSE_SECD: "04", HOUSE_SECD_NM: "무순위" })).toBe("무순위");
  });
});

describe("normalizeRemndrItem", () => {
  it("정상 아이템을 Notice로 변환하고 기본 접수 시각(09:00~17:30 KST)을 적용한다", () => {
    const n = normalizeRemndrItem(raw, VERIFIED);
    expect(n).not.toBeNull();
    expect(n!.id).toBe("2026000001-1");
    expect(n!.type).toBe("무순위");
    expect(n!.houseName).toBe("행복마을 어울림");
    expect(n!.region).toBe("경기");
    expect(n!.supplyCount).toBe(12);
    expect(n!.receiptStart).toBe("2026-07-10T00:00:00.000Z");
    expect(n!.receiptEnd).toBe("2026-07-10T08:30:00.000Z");
    expect(n!.lastVerifiedAt).toBe(VERIFIED);
  });

  it("단지명이나 접수일이 없으면 null", () => {
    expect(normalizeRemndrItem({ ...raw, HOUSE_NM: "" }, VERIFIED)).toBeNull();
    expect(normalizeRemndrItem({ ...raw, SUBSCRPT_RCEPT_BGNDE: undefined }, VERIFIED)).toBeNull();
  });

  it("공급규모가 숫자가 아니면 undefined", () => {
    const n = normalizeRemndrItem({ ...raw, TOT_SUPLY_HSHLDCO: "미정" }, VERIFIED);
    expect(n!.supplyCount).toBeUndefined();
  });
});

describe("normalizeRemndrItems", () => {
  it("불량 아이템은 걸러낸다", () => {
    const list = normalizeRemndrItems([raw, { HOUSE_NM: "" }], VERIFIED);
    expect(list).toHaveLength(1);
  });
});
