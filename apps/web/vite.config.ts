// 청약봄 웹앱 Vite 설정. GitHub Pages 하위 경로(/homebom/) 배포를 위한 base 포함.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/homebom/",
  plugins: [react()],
  test: {
    exclude: ["e2e/**", "node_modules/**"],
  },
});
