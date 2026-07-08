# DEPLOY

## 웹앱 (GitHub Pages) — 현재 배포 경로

- 공개 URL: https://runnerpyrri-lgtm.github.io/zoopzoopcall/
- 소스는 `main`, 배포 산출물은 `gh-pages` 브랜치(root). Pages 설정: Deploy from a branch → gh-pages.

재배포 절차:

```bash
pnpm build                       # packages/core 검사 + 아이콘 생성 + apps/web 빌드
cd apps/web/dist
git init && git add -A
git commit -m "deploy"
git push -f https://github.com/runnerpyrri-lgtm/zoopzoopcall.git HEAD:gh-pages
```

- SPA 라우팅은 HashRouter라 404 우회가 필요 없다.
- `vite.config.ts`의 `base: "/zoopzoopcall/"`가 저장소 이름과 일치해야 한다. 저장소 이름을 바꾸면 같이 바꾼다.

## 실데이터 연결 (사람 작업 + 함수 배포)

1. https://www.data.go.kr/data/15098547/openapi.do 활용신청 → 마이페이지에서 인증키 복사.
2. Supabase 프로젝트 생성 후:

```bash
supabase login
supabase link --project-ref <프로젝트ref>
supabase secrets set DATA_GO_KR_SERVICE_KEY=<인증키>
supabase functions deploy notices --no-verify-jwt
```

3. 함수 URL(`https://<ref>.functions.supabase.co/notices`)을 `apps/web/.env`에 설정:

```
VITE_NOTICES_URL=https://<ref>.functions.supabase.co/notices
```

4. `pnpm build` 후 위 재배포 절차 실행 → 화면 우상단 배지가 "샘플 데이터"에서 "실시간"으로 바뀐다.

주의:

- 서비스키는 절대 `apps/web`(.env의 VITE_ 아닌 변수 포함)이나 커밋에 넣지 않는다. Supabase secrets에만 둔다.
- 무료 서비스키는 일일 트래픽 제한(개발계정 4만)이 있어 함수에 10분 캐시를 뒀다.
- odcloud API가 `returnType=JSON`을 지원하므로 XML 파싱은 불필요(실측 확인).

## 검증 기록 (2026-07-08)

- `pnpm test` 37건 통과, `pnpm typecheck` 통과, `pnpm build` 성공.
- `vite preview`에서 index/JS/sw.js/manifest/아이콘 200 확인.
- 배포 URL 접속 확인은 배포 직후 curl로 수행(아래 DEVELOPMENT_LOG 참고).
