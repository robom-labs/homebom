// 공고 상세 카드가 좁은 화면과 큰 글자에서도 잘리거나 겹치지 않는지 검증한다.
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const HOUR = 3_600_000;
const now = Date.now();
const receiptStart = new Date(now - HOUR).toISOString();
const receiptEnd = new Date(now + 26 * HOUR).toISOString();

const notice = {
  id: "e2e-notice",
  type: "무순위",
  officialTypeName: "무순위(사후접수)",
  housingCategory: "아파트",
  sourceOperation: "getRemndrLttotPblancDetail",
  houseName: "가나다라마바사 아주 긴 단지명 청약봄 테스트",
  region: "서울",
  address: "서울특별시 아주 긴 주소에서도 숫자와 단위가 깨지지 않아야 하는 테스트 주소",
  supplyCount: 1,
  priceMin: 224000,
  priceMax: 224000,
  receiptStart,
  receiptEnd,
  winnerDate: "2026-07-20",
  contractStartDate: "2026-07-24",
  contractEndDate: "2026-07-26",
  applyHomeUrl: "https://www.applyhome.co.kr",
  noticeUrl: "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do",
  officialHomepageUrl: "https://example.com",
  businessOwnerName: "아주 긴 시행사 법인명 주식회사",
  contactPhone: "1533-0000",
  moveInMonth: "2027년 12월",
  modelDataStatus: "collected",
  modelDataVerifiedAt: new Date(now).toISOString(),
  modelSummaries: [{
    modelNo: "01",
    houseType: "84A",
    supplyArea: "84.90",
    supplyCount: 1,
    specialSupplyCount: 0,
    priceMax: 224000,
  }],
  events: [
    { id: "receipt", kind: "no-priority", label: "무순위·재공급 접수", start: receiptStart, end: receiptEnd, confirmed: true },
    { id: "winner", kind: "winner", label: "당첨자 발표", start: "2026-07-20T00:00:00+09:00", confirmed: true },
    { id: "contract", kind: "contract", label: "계약", start: "2026-07-24T09:00:00+09:00", end: "2026-07-26T17:30:00+09:00", confirmed: true },
  ],
  decisionSupport: {
    source: "notice-pdf",
    subscriptionAccount: "불필요",
    selectionMethod: "100% 추첨",
    applicantQualification: "무주택·유주택 여부와 거주지역 조건을 포함한 아주 긴 신청 자격 문장도 값 전체 폭에서 자연스럽게 줄바꿈되어야 합니다.",
    transferRestriction: "없음",
    residenceRequirement: "공고문 확인",
    rewinningRestriction: "미적용",
    constructionCompanyName: "아주 긴 시공사 이름 건설 주식회사",
    paymentSchedule: [
      { label: "계약금", ratio: "10%", amountManwon: 22400, timing: "계약 시" },
      { label: "중도금", ratio: "50%", amountManwon: 112000, timing: "공고문 지정일" },
      { label: "잔금", ratio: "40%", amountManwon: 89600, timing: "입주 지정기간" },
    ],
    verifiedAt: new Date(now).toISOString(),
  },
  priceSignal: {
    percentBelowMedian: 8.6,
    confidence: "high",
    source: "molit-trade",
    sourceLabel: "국토부 실거래",
    comparisonAreaLabel: "전용 84㎡급",
    sampleMonths: 6,
    verifiedAt: new Date(now).toISOString(),
  },
  lastVerifiedAt: new Date(now).toISOString(),
};

async function openDetail(page: Page) {
  await page.route("https://homebom.test/notices", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-verified-at": notice.lastVerifiedAt },
      body: JSON.stringify([notice]),
    });
  });
  await page.goto("#/notice/e2e-notice");
  await expect(page.getByRole("heading", { name: notice.houseName })).toBeVisible();
  await page.getByRole("button", { name: /더 보기/ }).click();
  await expect(page.getByRole("heading", { name: "신청 자격·제약" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("320~768px에서 숫자 단위와 긴 값이 깨지지 않는다", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await openDetail(page);
  for (const width of [320, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    const wrappedUnits = await page.locator(".detail__nowrap").evaluateAll((nodes) =>
      nodes.some((node) => node.getClientRects().length !== 1),
    );
    expect(wrappedUnits).toBe(false);
  }
  expect(browserErrors).toEqual([]);
});

test("큰 글자와 200% 확대에서도 상세 카드가 가로로 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 1000 });
  await openDetail(page);
  await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
  await expectNoHorizontalOverflow(page);

  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await expectNoHorizontalOverflow(page);
});

test("PR 설명용 모바일 스크린샷을 생성할 수 있다", async ({ page }) => {
  test.skip(process.env.UPDATE_SCREENSHOTS !== "1", "로컬 PR 스크린샷 생성 전용");
  await page.setViewportSize({ width: 390, height: 844 });
  await openDetail(page);
  const output = path.resolve(process.cwd(), "../../docs/screenshots/homebom-detail-card-390.png");
  await mkdir(path.dirname(output), { recursive: true });
  await page.locator(".decision-card").screenshot({ path: output });
});
