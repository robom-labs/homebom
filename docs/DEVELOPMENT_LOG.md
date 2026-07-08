# DEVELOPMENT_LOG

## 2026-07-08 — v0.1.0 (최초 구현)

### 결정과 근거

1. **플랫폼: Expo 네이티브 → 웹 PWA로 조정.** 이번 실행의 하드 요구는 "사람 개입 없이 한 번에 완성 + 컴퓨터가 꺼져도 접속 가능한 모바일 주소 + 알림 동작"이었다. EAS 빌드는 Expo/구글 계정·실기기 설치라는 사람 절차가 필수라 자율 완성이 불가능하다. 웹 PWA는 GitHub Pages URL로 즉시 충족하고, 도메인 로직은 전부 packages/core 순수함수라 v0.5.0 네이티브 전환 때 그대로 쓴다. 애드몹은 웹에서 의미가 없어(애드센스 영역) 네이티브 버전으로 이연.
2. **청약홈 API 실측.** data.go.kr 문서 페이지에서 스웨거 URL(infuser stages/37000)을 추출해 실스펙 확인: 엔드포인트 `api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancDetail`, `returnType=JSON` 지원(XML 정규화 불필요), `HOUSE_SECD` 04=무순위·06=불법행위 재공급. "취소후재공급"은 06으로 매핑. 접수일이 날짜만 와서 09:00~17:30 KST 기본 시각을 상수로 적용.
3. **샘플 데이터는 anchor 기반 상대 시각.** 고정 날짜면 며칠 뒤 전부 마감으로 보인다. 로드 시점 anchor(24시간 유지)에서 상대 배치해 접수중/마감임박/예정/정정/취소 전 상태가 항상 살아있고, 3분 뒤 시작하는 공고로 알림 실동작을 바로 확인할 수 있다. 샘플임은 목록·안내 화면에 명시(허위 정보로 보이지 않게).
4. **상태는 파생값.** Notice에 status를 저장하지 않고 getNoticeStatus(notice, now)로 계산. 정정은 접수 시작 전에만 상태로, 그 후엔 배지로 표시.
5. **알림 중복 방지.** 알림 ID를 `noticeId:kind:offset`으로 결정적으로 만들고 발송 이력을 localStorage에 남겨 스케줄러 재실행에도 한 번만 울린다. 6시간 지난 미발송 알림은 폐기(새벽에 폰을 안 봤다고 몰아서 울리지 않게).
6. **커밋 트레일러.** 원본 프롬프트는 Opus 4.8 트레일러를 지정했으나 실제 구현 모델이 Fable 5라 사실대로 `Claude Fable 5`로 기록.

### 실패·우회 기록

- winget 기본 소스(msstore) 인증서 오류 → `--source winget`으로 해결.
- infuser `oas/docs?namespace=...` 404 → 문서 페이지 HTML에서 stages URL 추출로 우회.
- 크롬 확장 미연결로 스크린샷 검수 불가 → HTTP 스모크 테스트(전 에셋 200)로 대체하고 한계를 보고에 명시.
- DetailScreen에서 finished 조건과 중복된 `status !== "취소"` 비교가 TS2367로 잡힘 → 중복 조건 제거.

### 검증

- `pnpm test`: core 37건 통과(상태판정·KST 경계·알림계산 골든마스터·정규화).
- `pnpm typecheck` / `pnpm build` 통과. vite preview에서 index·JS·sw·manifest·icon 200.

### 다음 세션이 알아야 할 것

- 실데이터 전환은 사람이 서비스키·Supabase만 준비하면 DEPLOY.md 절차대로 즉시 가능.
- 웹 알림은 실행 중에만 울린다는 한계를 사용자에게 이미 고지함. v0.2.0 Web Push가 최우선 과제.
