// 공고 정규화 단일 소스(packages/core/src/notice/normalize.ts) 를 이 Edge Function이 실제로
// import해서 쓸 수 있는지 확인하는 Deno 회귀 테스트다. index.ts와 동일한 상대경로를 써서,
// 그 경로가 깨지면(파일 이동·이름 변경 등) 여기서 먼저 실패한다.
//
// pnpm -r test(vitest)에는 포함되지 않는다 — Deno 런타임 코드라 Node 기반 vitest로 실행할 수
// 없다. 로컬에서 확인하려면: `deno test --allow-env supabase/functions/notices/normalize.shared.test.ts`
// core 쪽 정규화 로직 자체의 폭넓은 회귀 테스트(96개)는 packages/core/src/__tests__/normalize.test.ts에 있다.
import {
  buildNoticeIdentity,
  buildRemndrEvents,
  kstDateToUtcIso,
  normalizeExternalUrl,
  normalizeYmd,
  resolveNoticeType,
} from "../../../packages/core/src/notice/normalize.ts";

// 외부 네트워크 의존(예: deno.land/std) 없이 그때그때 쓰는 최소 assert.
function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(msg ?? `expected ${e}, got ${a}`);
}

Deno.test("normalizeYmd/kstDateToUtcIso는 core와 동일하게 동작한다(단일 소스 import 확인)", () => {
  assertEquals(normalizeYmd("20260725"), "2026-07-25");
  assertEquals(normalizeYmd("2026-02-30"), null);
  assertEquals(kstDateToUtcIso("2026-07-25", "09:00"), "2026-07-25T00:00:00.000Z");
});

Deno.test("resolveNoticeType은 HOUSE_SECD 06을 불법행위 재공급으로 판정한다", () => {
  assertEquals(resolveNoticeType({ HOUSE_SECD: "06" }), "불법행위 재공급");
});

Deno.test("normalizeExternalUrl은 &amp; 이스케이프를 되돌린다", () => {
  assertEquals(
    normalizeExternalUrl("https://example.kr/x?a=1&amp;b=2"),
    "https://example.kr/x?a=1&b=2",
  );
});

Deno.test("buildNoticeIdentity: manageNo·pblancNo가 둘 다 없으면 legacyIds를 만들지 않는다", () => {
  // 회귀 방지: Edge Function이 자체 정규화 코드를 갖고 있던 시절에는
  // `legacyId = "-"`가 항상 truthy라 legacyIds:["-"] 가 잘못 채워지는 버그가 있었다.
  // 단일 소스(core)로 옮기며 이 버그가 사라졌다 — 이 테스트가 재발을 막는다.
  const identity = buildNoticeIdentity(
    { HOUSE_MANAGE_NO: undefined, PBLANC_NO: undefined },
    "행복마을",
    "2026-07-25",
  );
  assertEquals(identity.legacyIds, undefined);
  assertEquals(identity.id, "notice-행복마을-2026-07-25-2026-07-25");
});

Deno.test("buildNoticeIdentity: manageNo·pblancNo가 둘 다 있으면 기존 레거시 ID 그대로 쓴다", () => {
  const identity = buildNoticeIdentity({ HOUSE_MANAGE_NO: 1, PBLANC_NO: 2 }, "행복마을", "2026-07-25");
  assertEquals(identity.id, "1-2");
  assertEquals(identity.legacyIds, undefined);
});

Deno.test("buildRemndrEvents: 무순위 접수 이벤트를 생성하고 noticeId를 붙인다", () => {
  const events = buildRemndrEvents({
    RCRIT_PBLANC_DE: "2026-07-01",
    SUBSCRPT_RCEPT_BGNDE: "2026-07-25",
    SUBSCRPT_RCEPT_ENDDE: "2026-07-25",
  }, "notice-1");
  assertEquals(events.every((item) => item.noticeId === "notice-1"), true);
  assertEquals(events.some((item) => item.kind === "no-priority"), true);
});
