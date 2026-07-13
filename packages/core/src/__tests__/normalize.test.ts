// 청약홈 API 원시 응답 정규화 테스트.
import { describe, expect, it } from "vitest";
import {
  buildNoticeIdentity,
  kstDateToUtcIso,
  normalizeExternalUrl,
  normalizeAptItem,
  normalizeRemndrItem,
  normalizeRemndrItems,
  normalizeYmd,
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

describe("normalizeAptItem", () => {
  it("APT 일반공급의 특별공급·순위별 접수와 발표·계약 일정을 보존한다", () => {
    const notice = normalizeAptItem(
      {
        ...raw,
        HOUSE_SECD: "01",
        HOUSE_SECD_NM: "APT",
        RCEPT_BGNDE: "2026-07-10",
        RCEPT_ENDDE: "2026-07-12",
        SPSPLY_RCEPT_BGNDE: "2026-07-10",
        SPSPLY_RCEPT_ENDDE: "2026-07-10",
        GNRL_RNK1_CRSPAREA_RCPTDE: "2026-07-11",
        GNRL_RNK1_CRSPAREA_ENDDE: "2026-07-11",
        GNRL_RNK2_ETC_AREA_RCPTDE: "2026-07-12",
        GNRL_RNK2_ETC_AREA_ENDDE: "2026-07-12",
        CNTRCT_CNCLS_BGNDE: "2026-07-20",
        CNTRCT_CNCLS_ENDDE: "2026-07-22",
      },
      VERIFIED,
      [{
        SUPLY_HSHLDCO: 0,
        SPSPLY_HSHLDCO: 3,
        NWWDS_HSHLDCO: 0,
        NWBB_HSHLDCO: 2,
        HOUSE_TY: "084.9000",
        LTTOT_TOP_AMOUNT: "70000",
      }],
    );

    expect(notice?.type).toBe("일반공급");
    expect(notice?.receiptStart).toBe("2026-07-10T00:00:00.000Z");
    expect(notice?.receiptEnd).toBe("2026-07-12T08:30:00.000Z");
    expect(notice?.events?.map((item) => item.label)).toEqual(
      expect.arrayContaining(["특별공급", "1순위 해당지역", "2순위 기타지역", "당첨자 발표", "계약"]),
    );
    expect(notice?.modelSummaries?.[0].supplyCount).toBe(0);
    expect(notice?.modelSummaries?.[0].specialSupplyCount).toBe(3);
    expect(notice?.modelSummaries?.[0].specialSupply?.newlywed).toBe(0);
    expect(notice?.modelSummaries?.[0].specialSupply?.newborn).toBe(2);
    expect(notice?.events?.every((item) => item.id?.startsWith(`${notice.id}:`))).toBe(true);
    expect(notice?.events?.find((item) => item.kind === "rank1")?.regionScope).toBe("local");
  });

  it("접수 일정이 전혀 없는 APT 공고는 제외한다", () => {
    expect(normalizeAptItem({ ...raw, SUBSCRPT_RCEPT_BGNDE: undefined, SUBSCRPT_RCEPT_ENDDE: undefined }, VERIFIED)).toBeNull();
  });
});

describe("normalizeYmd", () => {
  it("YYYY-MM-DD와 YYYYMMDD를 모두 YYYY-MM-DD로 정규화한다", () => {
    expect(normalizeYmd("2026-07-10")).toBe("2026-07-10");
    expect(normalizeYmd("20260710")).toBe("2026-07-10");
    expect(normalizeYmd(" 20260710 ")).toBe("2026-07-10");
  });

  it("형식이 맞지 않으면 null", () => {
    expect(normalizeYmd("")).toBeNull();
    expect(normalizeYmd(undefined)).toBeNull();
    expect(normalizeYmd("2026/07/10")).toBeNull();
    expect(normalizeYmd("미정")).toBeNull();
  });
});

describe("resolveNoticeType", () => {
  it("HOUSE_SECD 06은 불법행위 재공급", () => {
    expect(resolveNoticeType({ HOUSE_SECD: "06" })).toBe("불법행위 재공급");
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
    expect(n!.housingCategory).toBe("아파트");
    expect(n!.houseName).toBe("행복마을 어울림");
    expect(n!.region).toBe("경기");
    expect(n!.supplyCount).toBe(12);
    expect(n!.receiptStart).toBe("2026-07-10T00:00:00.000Z");
    expect(n!.receiptEnd).toBe("2026-07-10T08:30:00.000Z");
    expect(n!.lastVerifiedAt).toBe(VERIFIED);
    expect(n!.events?.find((item) => item.kind === "no-priority")?.id).toBe(
      "2026000001-1:SUBSCRPT_RCEPT_BGNDE",
    );
  });

  it("접수일이 YYYYMMDD로 와도 동일하게 변환한다", () => {
    const n = normalizeRemndrItem(
      { ...raw, SUBSCRPT_RCEPT_BGNDE: "20260710", SUBSCRPT_RCEPT_ENDDE: "20260710" },
      VERIFIED,
    );
    expect(n!.receiptStart).toBe("2026-07-10T00:00:00.000Z");
    expect(n!.receiptEnd).toBe("2026-07-10T08:30:00.000Z");
  });

  it("단지명이나 접수일이 없으면 null", () => {
    expect(normalizeRemndrItem({ ...raw, HOUSE_NM: "" }, VERIFIED)).toBeNull();
    expect(normalizeRemndrItem({ ...raw, SUBSCRPT_RCEPT_BGNDE: undefined }, VERIFIED)).toBeNull();
  });

  it("접수일 형식이 깨지면 해당 공고를 제외한다", () => {
    expect(normalizeRemndrItem({ ...raw, SUBSCRPT_RCEPT_ENDDE: "미정" }, VERIFIED)).toBeNull();
  });

  it("공급규모가 숫자가 아니면 undefined", () => {
    const n = normalizeRemndrItem({ ...raw, TOT_SUPLY_HSHLDCO: "미정" }, VERIFIED);
    expect(n!.supplyCount).toBeUndefined();
  });
});

describe("buildNoticeIdentity", () => {
  it("두 번호가 있으면 기존 ID를 유지한다", () => {
    expect(buildNoticeIdentity(raw, raw.HOUSE_NM, "2026-07-10").id).toBe("2026000001-1");
  });

  it("번호가 하나만 있으면 접수일을 포함한 안정 ID와 legacy ID를 만든다", () => {
    expect(buildNoticeIdentity({ ...raw, PBLANC_NO: undefined }, raw.HOUSE_NM, "2026-07-10")).toEqual({
      id: "manage-2026000001-2026-07-10",
      legacyIds: ["2026000001-"],
      manageNo: "2026000001",
      pblancNo: "",
    });
  });

  it("번호가 모두 없어도 같은 단지의 다른 공고가 충돌하지 않는다", () => {
    const noNumbers = { ...raw, HOUSE_MANAGE_NO: undefined, PBLANC_NO: undefined };
    const first = buildNoticeIdentity(noNumbers, raw.HOUSE_NM, "2026-07-10");
    const second = buildNoticeIdentity({ ...noNumbers, RCRIT_PBLANC_DE: "2026-07-02" }, raw.HOUSE_NM, "2026-07-11");
    expect(first.id).not.toBe("-");
    expect(first.id).not.toBe(second.id);
  });
});

describe("normalizeExternalUrl", () => {
  it("www 주소는 https로 보정하고 http·https만 허용한다", () => {
    expect(normalizeExternalUrl("www.applyhome.co.kr/path")).toBe("https://www.applyhome.co.kr/path");
    expect(normalizeExternalUrl("http://example.com/a")).toBe("http://example.com/a");
  });

  it("스크립트·데이터·상대 URL과 제어문자를 거부한다", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,x", "/relative", "https://exa\u0000mple.com"]) {
      expect(normalizeExternalUrl(value)).toBeUndefined();
    }
  });
});

describe("normalizeRemndrItems", () => {
  it("불량 아이템은 걸러낸다", () => {
    const list = normalizeRemndrItems([raw, { HOUSE_NM: "" }], VERIFIED);
    expect(list).toHaveLength(1);
  });
});
