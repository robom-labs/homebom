// 패밀리 셸의 모바일 내비·3개 앱 설정·PWA 설치 흐름을 실제 브라우저에서 검증한다.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// 릴리스마다 이 테스트를 고치지 않도록 현재 버전은 package.json에서 읽는다.
const appVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

async function openSettings(page: Page) {
  await page.route("https://homebom.test/notices", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("#/settings");
  await expect(page.getByRole("heading", { name: "업데이트", exact: true })).toBeVisible();
}

test("공통 wordmark와 48px 이상 safe-area 하단 메뉴, 3개 앱 메타를 제공한다", async ({ page }) => {
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

  const familySection = page.getByRole("region", { name: "로봄 패밀리 앱 3개" });
  await expect(familySection.getByRole("link")).toHaveCount(3);
  for (const name of ["야외봄", "러닝봄", "자격증봄"]) {
    await expect(familySection.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(appVersion, { exact: true })).toBeVisible();
  await expect(page.getByText(`zzc-v${appVersion}`, { exact: true })).toBeVisible();
  await expect(page.locator(".ad-slot")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("스토어 출시 전이라 설치 유도 CTA는 노출하지 않고 업데이트 확인만 제공한다", async ({ page }) => {
  await openSettings(page);
  // beforeinstallprompt는 계속 보관하지만(플러밍 유지) 사용자에게 설치 버튼을 띄우지 않는다.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperty(event, "prompt", { value: () => Promise.resolve() });
    Object.defineProperty(event, "userChoice", { value: Promise.resolve({ outcome: "dismissed", platform: "web" }) });
    window.dispatchEvent(event);
  });

  await expect(page.getByRole("button", { name: "이 기기에 청약봄 설치" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "업데이트 확인" })).toBeVisible();
});
