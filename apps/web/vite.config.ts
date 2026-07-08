// 줍줍콜 웹앱 Vite 설정. GitHub Pages 하위 경로(/zoopzoopcall/) 배포를 위한 base 포함.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/zoopzoopcall/",
  plugins: [react()],
});
