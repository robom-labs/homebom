// 청약봄 모바일 상세 화면의 실제 브라우저 회귀 검증 설정.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173/homebom/",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/homebom/",
    reuseExistingServer: false,
    env: {
      VITE_NOTICES_URL: "https://homebom.test/notices",
    },
  },
});
