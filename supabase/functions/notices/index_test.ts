// 청약홈 다섯 공식 공급 유형의 미래 공고 노출과 빈 활성 캐시 처리를 검증한다.
import {
  activeCachedBody,
  collectionStatsHeader,
  normalizeNotice,
  publishableNotices,
  type SourceKind,
} from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${
        JSON.stringify(actual)
      }`,
    );
  }
}

const NOW = Date.parse("2026-08-08T00:00:00.000Z");
const VERIFIED_AT = "2026-08-08T00:00:00.000Z";

function rawFor(kind: SourceKind): Record<string, unknown> {
  const suffix = {
    remndr: "01",
    apt: "02",
    urbty: "03",
    "public-rent": "04",
    optional: "05",
  }[kind];
  const raw: Record<string, unknown> = {
    HOUSE_MANAGE_NO: `20260000${suffix}`,
    PBLANC_NO: `20260000${suffix}`,
    HOUSE_NM: `${kind} 2주 뒤 공고`,
    HOUSE_SECD_NM: kind === "optional" ? "임의공급" : "주택",
    SUBSCRPT_AREA_CODE_NM: "서울",
    RCRIT_PBLANC_DE: "2026-08-08",
    PRZWNER_PRESNATN_DE: "2026-08-25",
    PBLANC_URL: "https://www.applyhome.co.kr/example",
  };
  if (kind === "apt") {
    raw.RCEPT_BGNDE = "2026-08-20";
    raw.RCEPT_ENDDE = "2026-08-21";
  } else {
    raw.SUBSCRPT_RCEPT_BGNDE = "2026-08-20";
    raw.SUBSCRPT_RCEPT_ENDDE = "2026-08-21";
  }
  if (kind === "remndr") raw.HOUSE_SECD = "04";
  if (kind === "urbty") raw.HOUSE_DTL_SECD_NM = "오피스텔";
  if (kind === "public-rent") raw.HOUSE_DETAIL_SECD_NM = "공공지원 민간임대";
  return raw;
}

function normalize(kind: SourceKind) {
  return normalizeNotice(
    rawFor(kind),
    [],
    VERIFIED_AT,
    kind,
    "not-collected",
    undefined,
    undefined,
    undefined,
    [],
    NOW,
  );
}

Deno.test("공식 다섯 공급 유형의 1~2주 뒤 공고를 모두 정규화한다", () => {
  const notices =
    (["remndr", "apt", "urbty", "public-rent", "optional"] as SourceKind[]).map(
      normalize,
    );
  assert(
    notices.every((notice) => notice !== null),
    "미래 공고가 누락되었습니다.",
  );
  assertEquals(
    notices.map((notice) => notice?.sourceOperation),
    [
      "getRemndrLttotPblancDetail",
      "getAPTLttotPblancDetail",
      "getUrbtyOfctlLttotPblancDetail",
      "getPblPvtRentLttotPblancDetail",
      "getOPTLttotPblancDetail",
    ],
    "공식 출처 매핑이 다릅니다",
  );
  assertEquals(
    notices.map((notice) => notice?.housingCategory),
    ["아파트", "아파트", "오피스텔", "공공지원 민간임대", "임의공급"],
    "고객용 주택 분류가 다릅니다",
  );
});

Deno.test("주택형 보강이 429로 늦어도 공식 APT 공고는 즉시 게시한다", () => {
  const apt = normalize("apt");
  assert(apt !== null, "APT 공고 정규화에 실패했습니다.");
  assertEquals(apt.modelDataStatus, "not-collected", "주택형 상태가 다릅니다");
  const published = publishableNotices([apt], NOW);
  assertEquals(
    published.map((notice) => notice.id),
    [apt.id],
    "부가 정보 없는 공식 공고가 차단됐습니다",
  );
});

Deno.test("활성 공고가 모두 끝난 캐시는 유효한 빈 목록으로 응답한다", () => {
  const apt = normalize("apt");
  assert(apt !== null, "APT 공고 정규화에 실패했습니다.");
  const afterClose = Date.parse("2026-08-22T15:00:00.000Z");
  assertEquals(
    activeCachedBody(JSON.stringify([apt]), afterClose),
    "[]",
    "빈 활성 목록이 캐시 미스로 바뀌었습니다",
  );
});

Deno.test("저장 스냅샷의 운영 통계를 공개 응답 헤더로 안전하게 복원한다", () => {
  const header = JSON.parse(collectionStatsHeader([{}, {}], {
    fetched: 514,
    valid: 25,
    preserved: 0,
    modelPending: 17,
    sources: { apt: { fetched: 138, active: 9 } },
  }));
  assertEquals(header.published, 2, "게시 건수");
  assertEquals(header.fetched, 514, "수집 건수");
  assertEquals(header.valid, 25, "유효 건수");
  assertEquals(header.modelPending, 17, "보강 대기 건수");
  assertEquals(header.sources.apt.active, 9, "아파트 활성 건수");
});
