# CHANGELOG

이 프로젝트는 [SemVer](https://semver.org/lang/ko/)를 따른다.

## [0.1.4] - 2026-07-10

유지보수·안정화 릴리스. 기능 변화 없이 버그 재발 방지와 장애 내성을 강화했다.

### 변경
- **버전 통일**: 루트·`apps/web`·`packages/core` 의 package.json 버전이 0.1.3 / 0.1.1 / 0.1.0 으로 제각각이던 것을 모두 **0.1.4** 로 통일했다. 앞으로는 세 파일을 같은 버전으로 유지한다.
- **CI 빌드 환경 일치**: CI(`ci.yml`) 빌드 단계에 배포(`deploy-pages.yml`)와 동일한 공개 실공고 엔드포인트(`VITE_NOTICES_URL`)를 명시해, CI가 프로덕션과 같은 번들 구성을 검증하도록 맞췄다. (공개 URL이며 비밀값 아님)
- **서비스워커 캐시 갱신**: 캐시 이름 `zzc-v1` → `zzc-v2`. activate 시 이전 버전 캐시는 기존 로직대로 자동 삭제된다(네트워크 우선 동작 동일).

### 추가
- **스케줄러 회귀 테스트 6건** (`apps/web/src/notify/__tests__/scheduler.regression.test.ts`):
  - 알림 권한이 `granted` 가 아닐 때 `check` 가 아무것도 fired 로 기록하지 않는지(v0.1.0 영구 억제 버그 재발 방지) + granted 대조군.
  - `collectDueAlerts` 의 6시간 유예창 경계(5시간 59분 경과 = 수집, 6시간 1분 경과 = 폐기)와 이미 fired 된 알림 제외.
  - `delivering` 인플라이트 가드: 같은 알림을 동시에 두 번 전달 시도해도 한 번만 표시·기록.
- **자가개선 워크플로** (`.github/workflows/daily-self-improve.yml`): 하루 2회(KST 06:00/18:00) Claude가 작은 개선 1개를 draft PR 로 올린다. `ANTHROPIC_API_KEY` 시크릿이 없으면 한국어 안내와 함께 즉시 실패한다(등록은 사람 작업). merge 는 항상 사람이 한다.

### 안정화
- **Edge Function 장애 내성** (`supabase/functions/notices/index.ts` — 배포는 사람이 수동으로):
  - stale-if-error: 청약홈 업스트림 장애 시 502 대신 마지막 성공 응답을 `X-Data-Stale: 1` 헤더와 함께 서빙.
  - 업스트림 호출에 AbortController 8초 타임아웃 추가.
  - IP당 분당 30회 인메모리 rate limiter(인스턴스별 best-effort; 플랫폼 차원의 정식 제한은 사람 작업).
  - 공고 정규화 로직·응답 형태는 무변경.
- **웹 무한 로딩 방지** (`apps/web/src/hooks/useNotices.ts`): 실공고 요청에 10초 AbortController 타임아웃을 걸어, 응답이 멈추면 로딩이 아니라 에러 상태로 전환된다.

### 정리
- **회장님 승인 하에** 낡은 스냅샷 디렉터리 삭제: `zoop-holdings/`(구 지주회사 저장소 복사본, VERSION 0.2.0 — 실제 저장소는 runnerpyrri-lgtm/Zoop-holdings), `docs/zoop-holdings/`(구 청사진 스냅샷). 앱 코드가 참조하지 않음을 grep 으로 확인했다.

## [0.1.3] - 2026-07-10

### 수정
- 브라우저나 서비스워커가 알림 표시를 거부한 경우에는 발송 완료로 기록하지 않도록 변경했다. 표시가 실제로 성공한 뒤에만 중복 방지 기록을 남기며, 진행 중인 같은 알림의 중복 발송도 막는다.
- 원본 저장소 PR에서 타입체크·테스트·프로덕션 빌드를 실행하는 CI를 추가했다.
- Pages 자동 배포가 실공고 URL 없이 빈 화면용 번들을 만들지 않도록 공개 실공고 엔드포인트를 빌드 환경에 명시했다.

## [0.1.2] - 2026-07-10

### 변경
- `정정` 배지 로직을 공용 `CorrectionBadge` 컴포넌트로 추출 — `NoticeCard`·`DetailScreen`에 중복돼 있던 표시 규칙(`corrected && 상태≠"정정"`)을 한 곳으로. 동작 동일. typecheck·build·core 테스트(44) 통과.

## [0.1.1] - 2026-07-09

### 수정

- **알림 권한을 켜기 전이면 알림이 영구히 억제되던 버그 수정** (`apps/web/src/notify/scheduler.ts`).
  스케줄러가 알림을 표시하기 전에 먼저 "울림 처리"(`markFired`)를 했는데, 권한이 아직 `granted` 가 아니면
  `showAppNotification` 이 조용히 리턴해 실제로는 안 울렸다. 그래도 이미 울림 처리가 돼서, 사용자가 나중에
  권한을 허용해도 그 알림은 다시 오지 않았다(앱 핵심 목적 실패). → 권한이 `granted` 가 아니면 `check()` 가
  아무것도 하지 않도록(울림 처리도 안 함) 가드 추가. 권한 허용 후 유예시간(6시간) 안이면 그때 정상적으로 울린다.
  base path·비밀키·API 무변경. 타입체크·빌드·코어 테스트 44건 통과.

## [0.1.0] - 2026-07-08

### 추가

- `packages/core`: Notice 도메인 타입, 상태 판정(`getNoticeStatus`/`isClosingSoon`), KST D-day·표기·남은시간(`ddayKst`/`formatKstDateTime`/`formatRemaining`/`formatManwon`), 알림 계산(`buildNoticeAlerts`, 시작 [1일·3시간·정각] / 마감 [1일·3시간·1시간] 프리셋, 과거 미예약), 청약홈 API(15098547) 실측 스펙 정규화(`normalizeRemndrItems`). Vitest 테스트 31건 + 골든마스터.
- `apps/web`: React+Vite PWA. 공고 목록(유형·지역·접수중 필터, 접수중/예정/마감 그룹), 상세(1초 카운트다운, 알림 프리셋 토글, 청약홈 딥링크), 내 알림(예약 목록·5초 테스트 알림·권한 안내), 안내 화면. 로컬 알림 스케줄러(15초 폴링+화면복귀 체크, 발송 이력 중복 방지). 서비스워커(오프라인 셸 캐시, 알림 클릭 → 청약홈). 도장 스탬프 D-day·공고문 종이 디자인, 라이트/다크, 반응형, 접근성(포커스·모션 최소화).
- `supabase/functions/notices`: 서비스키를 서버에 숨기는 청약홈 API 프록시(10분 캐시, JSON 정규화). 배포 절차는 DEPLOY 문서.
- PWA 아이콘 생성 스크립트(외부 의존성 없는 PNG 인코더), 매니페스트, GitHub Pages 배포.
- 문서 6종 + docs/superpowers specs/plans v0.1.0 페어.

### 설계 결정

- v0.1.0 플랫폼을 Expo 네이티브 대신 **웹 PWA 우선**으로 조정: 사람 개입 없이 즉시 접속 가능한 모바일 URL 제공이 목표였고, EAS 빌드·스토어 등록은 계정·수동 절차가 필요하기 때문. Expo 앱·애드몹은 로드맵 후속 버전으로 이동 (근거: docs/DEVELOPMENT_LOG.md).
- 실데이터는 서비스키 발급(사람 몫) 전까지 샘플 공고로 대체하고, 화면에 샘플임을 명시.
