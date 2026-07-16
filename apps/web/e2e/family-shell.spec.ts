// 패밀리 셸의 모바일 내비·5개 앱 설정·PWA 설치 흐름을 실제 브라우저에서 검증한다.
import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page) {
  await page.route("https://homebom.test/notices", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("#/settings");
  await expect(page.getByRole("heading", { name: "설치와 업데이트" })).toBeVisible();
}

test("공통 wordmark와 48px 이상 safe-area 하단 메뉴, 5개 앱 메타를 제공한다", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openSettings(page);

  const wordmark = page.locator(".appbar__bom");
  await expect(wordmark).toHaveAttribute("src", /wordmark|data:image\/svg\+xml/);
  await expect.poll(() => wordmark.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  const navGeometry = await page.locator(".nav").evaluate((nav) => ({
    height: nav.getBoundingClientRect().height,
    tabHeights: [...nav.querySelectorAll("a")].map((tab) => tab.getBoundingClientRect().height),
  }));
  expect(navGeometry.height).toBeGreaterThanOrEqual(72);
  expect(navGeometry.tabHeights.every((height) => height >= 48)).toBe(true);

  const familySection = page.getByRole("region", { name: "로봄 패밀리 앱 5개" });
  await expect(familySection.getByRole("link")).toHaveCount(5);
  for (const name of ["야외봄", "청약봄", "러닝봄", "캘린더봄", "자격증봄"]) {
    await expect(familySection.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("0.14.1", { exact: true })).toBeVisible();
  await expect(page.getByText("zzc-v0.14.1", { exact: true })).toBeVisible();
  await expect(page.locator(".ad-slot")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("beforeinstallprompt를 앱 시작부터 보관해 설치 CTA에서 사용한다", async ({ page }) => {
  await openSettings(page);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperty(event, "prompt", { value: () => Promise.resolve() });
    Object.defineProperty(event, "userChoice", { value: Promise.resolve({ outcome: "dismissed", platform: "web" }) });
    window.dispatchEvent(event);
  });

  const installButton = page.getByRole("button", { name: "이 기기에 청약봄 설치" });
  await expect(installButton).toBeVisible();
  await installButton.click();
  await expect(page.getByText("설치를 취소했습니다. 언제든 다시 시도할 수 있어요.")).toBeVisible();
});

test.describe("iPhone Safari 설치 fallback", () => {
  test.use({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });

  test("Safari 홈 화면 추가 안내를 보여준다", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("button", { name: "아이폰 설치 방법 보기" }).click();
    await expect(page.getByText(/Safari의 공유 버튼.*홈 화면에 추가/)).toBeVisible();
  });
});
