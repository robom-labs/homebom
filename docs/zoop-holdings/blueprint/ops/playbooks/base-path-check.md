# base path 보호 플레이북 — "/zoopzoopcall/" 는 절대 안 깨진다

## 왜
`apps/web/vite.config.ts`의 `base: "/zoopzoopcall/"`는 배포 URL
`https://runnerpyrri-lgtm.github.io/zoopzoopcall/`와 1:1이다. 바뀌면 기존 사용자 링크가 전부 깨진다.

## 4중 방어
1. **구조**: 관제 저장소 모델(A). holdings는 앱을 배포하지 않으므로 URL을 바꿀 주체가 없다.
2. **CI(guardrails.yml)**: `base-path-guard`가 PR마다 grep으로 검사, 바뀌면 실패.
3. **CODEOWNERS**: `vite.config.ts`, `manifest.webmanifest`, `sw.js`를 사람 승인 필수 파일로 지정.
4. **배포 스모크**: 릴리스 전 `pnpm build` 후 `dist/index.html`에 `/zoopzoopcall/` 자산 경로 확인.

## 참고
- 라우팅은 HashRouter라 SPA 404 폴백이 필요 없다. "폴백 추가" 같은 헛수정을 하지 말 것.
