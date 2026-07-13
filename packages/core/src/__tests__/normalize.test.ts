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
  sanitizeNoticeUrls,
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

  it("달력에 존재하지 않는 날짜를 거부한다", () => {
    expect(normalizeYmd("2026-02-29")).toBeNull();
    expect(normalizeYmd("2026-02-30")).toBeNull();
    expect(normalizeYmd("2024-02-29")).toBe("2024-02-29");
    expect(normalizeYmd("2026-13-01")).toBeNull();
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

describe("청약홈 &amp; URL 복구", () => {
  it("PBLANC_URL의 &amp; XML 이스케이프를 되돌려 공고 파라미터를 살린다", () => {
    // API가 &를 &amp;로 이스케이프하면 pblancNo가 amp;pblancNo가 되어 청약홈이 404를 낸다.
    const escaped =
      "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2025000449&amp;pblancNo=2025000449";
    const fixed = normalizeExternalUrl(escaped);
    expect(fixed).toBe(
      "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2025000449&pblancNo=2025000449",
    );
    expect(new URL(fixed!).searchParams.get("pblancNo")).toBe("2025000449");
    // 숫자 엔티티(&#38;)와 정상 URL은 각각 복구·무변경(idempotent)이다.
    expect(normalizeExternalUrl("https://a.co/x?a=1&#38;b=2")).toBe("https://a.co/x?a=1&b=2");
    expect(normalizeExternalUrl("https://a.co/x?a=1&b=2")).toBe("https://a.co/x?a=1&b=2");
  });
});

describe("sanitizeNoticeUrls", () => {
  it("깨진 noticeUrl·officialHomepageUrl을 복구하고 정상 값은 그대로 둔다", () => {
    const broken = {
      noticeUrl: "https://www.applyhome.co.kr/d.do?houseManageNo=1&amp;pblancNo=1",
      officialHomepageUrl: "https://model.example.com",
      totalHouseholdSourceUrl: undefined,
    };
    const fixed = sanitizeNoticeUrls(broken);
    expect(fixed.noticeUrl).toBe("https://www.applyhome.co.kr/d.do?houseManageNo=1&pblancNo=1");
    // 정상 URL은 유효하게 보존된다(호스트만 있는 주소는 표준 후행 슬래시가 붙는다).
    expect(fixed.officialHomepageUrl).toBe("https://model.example.com/");
    expect(fixed.totalHouseholdSourceUrl).toBeUndefined();
  });

  it("고칠 게 없으면 같은 객체 참조를 반환한다", () => {
    const clean = { noticeUrl: "https://a.co/x?a=1&b=2", officialHomepageUrl: undefined, totalHouseholdSourceUrl: undefined };
    expect(sanitizeNoticeUrls(clean)).toBe(clean);
  });
});

describe("normalizeRemndrItems", () => {
  it("불량 아이템은 걸러낸다", () => {
    const list = normalizeRemndrItems([raw, { HOUSE_NM: "" }], VERIFIED);
    expect(list).toHaveLength(1);
  });
});
