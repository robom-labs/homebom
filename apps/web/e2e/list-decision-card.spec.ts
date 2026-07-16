// 목록 카드가 목표 의사결정 디자인과 반응형 동작을 유지하는지 검증한다.
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const HOUR = 3_600_000;
const now = Date.now();
const notice = {
  id: "list-e2e-notice",
  type: "무순위",
  officialTypeName: "무순위(사후접수)",
  housingCategory: "아파트",
  sourceOperation: "getRemndrLttotPblancDetail",
  houseName: "래미안 원펜타스 목록 카드 테스트",
  region: "서울",
  address: "서울특별시 서초구 반포동 아주 긴 테스트 주소",
  supplyCount: 1,
  priceMin: 224000,
  priceMax: 224000,
  receiptStart: new Date(now - HOUR).toISOString(),
  receiptEnd: new Date(now + 26 * HOUR).toISOString(),
  winnerDate: "2026-07-20",
  contractStartDate: "2026-07-24",
  contractEndDate: "2026-07-26",
  applyHomeUrl: "https://www.applyhome.co.kr",
  noticeUrl: "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do",
  businessOwnerName: "반포주공1단지 재건축조합",
  contactPhone: "1533-0000",
  moveInMonth: "2027년 12월",
  announceDate: new Date(now).toISOString().slice(0, 10),
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
    { id: "announce", kind: "announce", label: "모집공고", start: new Date(`${new Date(now).toISOString().slice(0, 10)}T00:00:00+09:00`).toISOString(), end: new Date(`${new Date(now).toISOString().slice(0, 10)}T23:59:00+09:00`).toISOString(), confirmed: false, timeSource: "date-only", startTimeConfirmed: false, endTimeConfirmed: false },
    { id: "receipt", kind: "no-priority", label: "무순위·재공급 접수", start: new Date(now - HOUR).toISOString(), end: new Date(now + 26 * HOUR).toISOString(), confirmed: true, timeSource: "official", startTimeConfirmed: true, endTimeConfirmed: true },
    { id: "winner", kind: "winner", label: "당첨자 발표", start: "2026-07-20T00:00:00+09:00", confirmed: true },
    { id: "contract", kind: "contract", label: "계약", start: "2026-07-24T09:00:00+09:00", end: "2026-07-26T17:30:00+09:00", confirmed: true },
  ],
  decisionSupport: {
    source: "notice-pdf",
    subscriptionAccount: "불필요",
    selectionMethod: "100% 추첨",
    applicantQualification: "무주택·유주택 무관 · 해당지역 거주 · 만 19세 이상 신청 가능합니다.",
    transferRestriction: "없음",
    residenceRequirement: "없음",
    rewinningRestriction: "미적용",
    constructionCompanyName: "삼성물산 주식회사",
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

async function openList(page: Page) {
  await page.route("https://homebom.test/notices", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-verified-at": notice.lastVerifiedAt },
      body: JSON.stringify([notice]),
    });
  });
  await page.goto("#/");
  await expect(page.getByRole("heading", { name: /래미안 원펜타스/ })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("목록 카드에서 목표 정보 위계와 펼침 내용을 바로 제공한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openList(page);
  const card = page.locator(".decision-card--list");

  await expect(card.getByText("접수 마감까지")).toBeVisible();
  await expect(card.getByText("인근 실거래 대비")).toBeVisible();
  await expect(card.getByText("고신뢰")).toBeVisible();
  await expect(card.getByText("분양가", { exact: true })).toBeVisible();
  await expect(card.getByText("공급면적", { exact: true })).toBeVisible();
  await expect(card.getByText("모집세대", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: "청약홈 열기" })).toBeVisible();

  await card.getByRole("button", { name: /나머지 정보 더 보기/ }).click();
  for (const heading of ["신청 자격·제약", "납부 일정", "청약 일정", "공급 구성", "단지 정보"]) {
    await expect(card.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(card.getByText("데이터 마지막 확인")).toBeVisible();
  await expect(card.getByText("국토부 실거래 외부값")).toBeVisible();
  await expect(page.getByRole("tab", { name: /마감|취소/ })).toHaveCount(0);
  await expect(page.getByText("공고문 확인", { exact: true })).toHaveCount(0);
});

test("설정 안내 문구와 PWA 캐시가 정확히 한 번 표시된다", async ({ page }) => {
  await page.route("https://homebom.test/notices", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([notice]) });
  });
  await page.goto("#/settings");
  await expect(page.getByText("청약 정보는 정정될 수 있으니, 신청 전 청약홈에서 최종 내용을 한 번 더 확인해 주세요.", { exact: true })).toHaveCount(1);
  await expect(page.getByText("zzc-v0.14.1", { exact: true })).toBeVisible();
});

test("달력 공고 마커의 접근성 이름과 상세 알림 딥링크가 실제 동작한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openList(page);
  await expect(page.getByRole("button", { name: /공고 1건/ })).toBeVisible();

  await page.goto(`#/notice/${notice.id}#alerts`);
  const alerts = page.locator("#alerts");
  await expect(alerts).toBeFocused();
  await expect(alerts).toBeInViewport();
  const navTop = await page.locator(".nav").evaluate((node) => node.getBoundingClientRect().top);
  const alertsTop = await alerts.evaluate((node) => node.getBoundingClientRect().top);
  expect(alertsTop).toBeLessThan(navTop);
});

test("직접 상세 URL은 데이터 로딩 중 공고 없음으로 오인하지 않는다", async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("https://homebom.test/notices", async (route) => {
    await responseGate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([notice]) });
  });
  await page.goto(`#/notice/${notice.id}`);
  await expect(page.getByText("공고를 불러오는 중입니다…", { exact: true })).toBeVisible();
  await expect(page.getByText("공고를 찾을 수 없어요", { exact: true })).toHaveCount(0);
  releaseResponse();
  await expect(page.getByRole("heading", { name: /래미안 원펜타스/ })).toBeVisible();
});

test("320px 첫 공고가 고정 하단 메뉴 위에서 시작된다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openList(page);
  const cardTop = await page.locator(".decision-card--list").evaluate((node) => node.getBoundingClientRect().top);
  const navTop = await page.locator(".nav").evaluate((node) => node.getBoundingClientRect().top);
  expect(cardTop).toBeLessThan(navTop);
});

test("320~768px와 200% 확대에서 목록 카드가 잘리거나 넘치지 않는다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openList(page);
  await page.locator(".decision-card--list").getByRole("button", { name: /나머지 정보 더 보기/ }).click();

  for (const width of [320, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoHorizontalOverflow(page);
    const wrappedUnits = await page.locator(".decision-card--list .detail__nowrap").evaluateAll((nodes) =>
      nodes.some((node) => node.getClientRects().length !== 1),
    );
    expect(wrappedUnits).toBe(false);
  }

  await page.setViewportSize({ width: 720, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("PR 설명용 목록 카드 스크린샷을 생성할 수 있다", async ({ page }) => {
  test.skip(process.env.UPDATE_SCREENSHOTS !== "1", "로컬 PR 스크린샷 생성 전용");
  await page.setViewportSize({ width: 390, height: 844 });
  await openList(page);
  const output = path.resolve(process.cwd(), "../../docs/screenshots/homebom-list-decision-card-390.png");
  await mkdir(path.dirname(output), { recursive: true });
  const card = page.locator(".decision-card--list");
  await card.screenshot({ path: output });
  await card.getByRole("button", { name: /나머지 정보 더 보기/ }).click();
  await card.screenshot({
    path: path.resolve(process.cwd(), "../../docs/screenshots/homebom-list-decision-card-expanded-390.png"),
  });
});
