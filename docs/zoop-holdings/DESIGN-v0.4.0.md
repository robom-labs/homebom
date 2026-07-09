# zoop-holdings — 1인 지주회사 자동 운영 시스템 설계서 v0.4.0

> 최종 검토·업그레이드 리포트
> 작성 기준일: 2026-07-09
> 상태: 설계 확정 직전(v0.4.0). 다음 단계는 `zoop-holdings` 저장소 실제 착수(v1.0.0).
> 이 문서는 **실제 `zoopzoopcall` 코드베이스를 전수 조사한 결과**를 근거로 v0.3.0 초안을 검토·수정한 것이다.

---

## 0. 실측 요약 — 코드를 다 보고 확인한 사실

설계를 논하기 전에, 현재 실제 상태부터 못 박는다. (이게 v0.3.0 초안에서 가장 부족했던 부분이다. 초안은 "이랬으면 좋겠다"였고, 아래는 "실제로 이렇다"이다.)

### 실존 저장소 (2026-07-09 기준)
| 저장소 | 공개 | 실제 상태 | 비고 |
|---|---|---|---|
| `runnerpyrri-lgtm/zoopzoopcall` | public | **실구현 v0.1.0** | pnpm 모노레포, PWA 배포 중 |
| `runnerpyrri-lgtm/runningcall` | public | 초기(사실상 빈 저장소) | 0.0.0 |
| `runnerpyrri-lgtm/pushrun` | public | 초기(사실상 빈 저장소) | 0.0.0 |
| `runnerpyrri-lgtm/zoop-holdings` | — | **아직 존재하지 않음** | 이 설계의 대상 |

### zoopzoopcall 실측 구조
```
zoopzoopcall/                      # pnpm@9.15.9, private, v0.1.0
  package.json                     # scripts: test/typecheck/build = 전부 "pnpm -r ..."
  pnpm-workspace.yaml              # packages/*  apps/*
  apps/web/                        # @zoopzoopcall/web  React18 + Vite5 PWA (HashRouter)
    vite.config.ts                 # base: "/zoopzoopcall/"   ← 하드코딩
    scripts/generate-icons.mjs     # 빌드 첫 단계에서 아이콘 PNG 생성
    public/{sw.js, manifest.webmanifest, icons/}
    src/{screens(4), components(7), hooks, notify, store}
  packages/core/                   # @zoopzoopcall/core  순수함수 라이브러리
    package.json                   # main/types → "src/index.ts" (빌드 없음, raw TS 소비)
    src/__tests__/                 # Vitest, 5개 파일 + 1 스냅샷(골든마스터), ~37 케이스
  supabase/functions/notices/      # Deno edge function (정부 API 프록시, 서비스키 서버보관)
  docs/                            # DEPLOY, ROADMAP, TODO, DEVELOPMENT_LOG, PROJECT_SPEC
```

### 설계에 직접 영향을 주는 "불편한 진실" 6가지
1. **자동화 인프라가 0이다.** `.github/`(GitHub Actions) 없음, `.claude/` 없음, `ops/` 없음, ESLint/Prettier/Husky 없음. 정적 게이트는 `tsc --noEmit` 하나뿐.
2. **배포가 수동이다.** `pnpm build` → `apps/web/dist`를 `gh-pages` 브랜치로 `git push -f`. CI 배포가 아니다. 즉 "안전한 자동 PR 공장"을 만들려면 배포/CI 파이프라인을 **맨바닥부터** 깔아야 한다.
3. **base path가 저장소 이름에 묶여 있다.** `base: "/zoopzoopcall/"`은 `github.io/zoopzoopcall/` URL과 1:1이다. 앱을 `zoop-holdings/apps/zoopzoopcall/`로 옮기고 거기서 배포하면 **URL이 바뀐다.** 이게 "확정된 결정 #3"을 깨는 1순위 위험이다.
4. **`packages/core`는 raw TS를 그대로 소비한다.** 빌드 산출물이 없다. 이건 오히려 좋다(모노레포 이식이 쉬움). 단, 앱마다 core를 두면 버전 충돌이 생기므로 **공유 core 정책**이 필요하다.
5. **정규화 로직이 두 군데 손동기화 중이다.** `packages/core/src/notice/normalize.ts`와 `supabase/functions/notices/index.ts`가 같은 로직을 복붙으로 유지한다(코드에 "동기화 유지" 주석 존재). 이건 회사가 커지면 반드시 터지는 버그 소스다.
6. **HashRouter를 쓴다.** 이건 유리한 사실이다. SPA 404 폴백이 필요 없어서 base path만 지키면 라우팅이 안 깨진다.

> 결론: v0.3.0 조직도는 "사람이 많은 회사"에 집중했는데, **실제 리스크는 조직이 아니라 인프라(CI·배포·base path·코드중복)에 있다.** v0.4.0은 조직을 줄이고 인프라 가드레일을 코드로 박는 쪽으로 무게중심을 옮긴다.

---

## 1. 전체 평가

**방향성 총평: 8/10. 철학은 옳고, 편성은 과하며, 가장 중요한 안전장치를 사람(agent)으로 착각하고 있다.**

잘한 것:
- "회사 1개 + 중앙 부서 + 앱별 스쿼드"는 **정답이다.** (2절에서 논증)
- "조직도는 크게, 매일 부르는 직원은 적게"라는 원칙은 토큰 비용 관점에서 정확하다.
- main 직접 push 금지 / PR-only / secret·배포 사람승인 — 이 안전 원칙은 그대로 유지한다.
- 버전 3층위(설계문서/앱/시스템)와 SemVer×권한 매트릭스는 실무적으로 훌륭하다.

고쳐야 할 것 (핵심 3가지):
1. **가드레일을 agent로 만들지 마라.** Regression Guard·Secret Guard·Permission Controller·Dependency Watcher는 "직원"이 아니라 **CI 검사(코드)**여야 한다. LLM에게 매번 시켜서 확률적으로 통과시키는 것보다, grep/gitleaks/Dependabot으로 결정론적으로 100% 막는 게 싸고 확실하고 24시간 돈다. (5절·7절)
2. **v1 직원 수는 12명도 많다. 실동 5명 + 주간 1명이면 충분하다.** 나머지는 "등록된 명단"이 아니라 **playbook 문서**로 먼저 존재하다가, 실제 병목이 생기면 agent로 승격시켜라. 없는 병목을 위해 프롬프트를 유지보수하는 건 순손실이다.
3. **"모노레포 안의 모노레포"를 문자 그대로 하지 마라.** 앱 코드를 `zoop-holdings/apps/*`에 복제해 넣고 거기서 배포하면 base path·Pages·중복동기화 문제가 전부 켜진다. **holdings는 "관제(control-plane) 저장소"로 두고, 앱은 각자 저장소에 남기고, holdings의 agent가 각 앱 저장소에 PR을 여는** 방식이 더 안전하고 10개까지 그대로 확장된다. (2절·8절)

---

## 2. 회사 1개 구조 vs 앱별 회사 구조 — 그리고 "관제 저장소" 재정의

### 2-1. 결론
| 축 | 앱별 회사 3개 | **회사 1개 + 중앙부서 + 스쿼드 (권장)** |
|---|---|---|
| 규칙 통일(보안/배포/버전) | ✗ 3벌 복제·표류 | ✓ 1벌로 통제 |
| 앱 10개 확장 | ✗ 조직 10벌, 관리 폭발 | ✓ 중앙 고정 + 앱당 state/roadmap만 추가 |
| 토큰 비용 | ✗ 중복 조직 중복 호출 | ✓ 중앙 재사용 |
| 앱 독립성 | ✓ 완전 격리 | △ state/scorecard로 격리(충분) |
| CEO 통합 우선순위 | ✗ 불가(회사가 3개) | ✓ 포트폴리오 단일 판단 |

**회사 1개가 맞다.** 여기까진 초안대로다.

### 2-2. 그런데 "회사 1개"를 **저장소 1개에 코드까지 다 넣는 것**과 혼동하면 안 된다

초안의 "확정된 결정"에는 서로 당기는 두 조항이 있다:
- 결정 #2: 기존 `zoopzoopcall` 저장소는 손대지 않는다.
- 결정 #3: `/zoopzoopcall/` Pages URL은 절대 안 깨진다.

이 둘을 지키면서 앱 코드를 `zoop-holdings/apps/zoopzoopcall/`에 "넣으면", 코드가 **두 곳(원본 저장소 + holdings)**에 존재하게 되어 동기화 문제가 생긴다. 그래서 나눠서 봐야 한다. 세 가지 모델:

| 모델 | 앱 코드 위치 | 배포 | base path 위험 | 확장성 | 평가 |
|---|---|---|---|---|---|
| **A. 관제 저장소(권장)** | 각 앱 **원본 저장소에 그대로** | 원본 저장소 gh-pages (변화 없음) | **없음** | ★★★★★ | holdings엔 ops/·agents·workflow만. agent가 원본 저장소에 PR |
| B. 서브모듈 | 원본 저장소(참조) | 원본에서 | 없음 | ★★★★ | 단일 소스지만 서브모듈 커밋 핀 관리 번거로움 |
| C. subtree 복제 | holdings/apps/* (사본) | holdings에서 재배포 | **높음** | ★★★ | 진짜 모노레포지만 URL·중복동기화 켜짐 |

**권장: 모델 A (관제 저장소 = control plane).** 이유:
- 결정 #2·#3이 **자동으로** 지켜진다. holdings는 앱 코드를 배포하지 않으므로 `/zoopzoopcall/` URL을 건드릴 방법 자체가 없다.
- "회사 1개" 철학은 조직·규칙·기록의 통일이지 코드 물리 위치의 통일이 아니다. 관제 저장소가 그 통일을 담당한다.
- 앱이 10개가 되어도 holdings 크기는 그대로다(state 파일 10개만 추가). subtree 모델이면 holdings 저장소가 10개 앱 전체를 담아 무거워진다.
- "federated monorepo"라는 초안의 직관은 옳았다. 다만 federation의 단위를 **디렉터리(apps/*)가 아니라 저장소(참조)**로 잡는 게 정확한 구현이다.

> 만약 그래도 "한 저장소 안에서 다 보고 싶다"가 강한 요구라면 → 모델 B(서브모듈)를 절충안으로. 모델 C(복제 배포)는 base path 결정(9절)을 완전히 끝내기 전엔 금지.

---

## 3. 추천 조직도 (v0.4.0)

핵심 변화: **가드레일 부서(보안/QA 일부)를 "부서(agent)"에서 "CI 검사(코드)"로 강등**하고, 나머지를 실동/대기로 계층화했다.

```
zoop-holdings  (관제 저장소 / control plane)
│
├─ 사람 대표 / Owner ★최종권한
│    main merge · 배포 · 결제 · secret · MAJOR 착수 승인
│
├─ AI CEO / Orchestrator ●매일
│    회사 상태 읽고 → 오늘 앱1·목표1·직원편성 결정 → 결과 기록
│
├─ 사장 직할실 / CEO Office
│    ├─ Chief of Staff ●매일        우선순위·일정·blocked 관리 (CEO에 통합 가능)
│    ├─ Agent Performance Reviewer ○주간   직원 성과·반복실수·프롬프트 개선 지시
│    └─ Memory Librarian ●매일       state·CHANGELOG·DECISIONS·ROADMAP 갱신
│
├─ 제품전략실 / Product
│    ├─ App PM ●매일               오늘 그 앱의 작업 1개 정의 + acceptance
│    └─ Portfolio PM ○월간          앱 포트폴리오 우선순위·존폐 판단
│
├─ 개발본부 / Engineering
│    ├─ Implementation Engineer ●매일   실제 코드 수정 (범위선언 안에서만)
│    ├─ Architect ○월간/TF          구조 설계·모노레포 충돌 방지
│    └─ Refactor Janitor ◇필요시      소규모 리팩토링·문서정리
│
├─ QA/릴리즈본부 / QA & Release
│    ├─ QA Auditor ●매일            test·build·typecheck·변경범위 검사 (사람 최종게이트 아님)
│    └─ Release Manager ○주간        버전후보·CHANGELOG·PR설명 검토
│
├─ ⚙️ 자동 가드레일 (부서가 아니라 CI. 사람도 agent도 못 우회)
│    ├─ base-path-guard      "/zoopzoopcall/" 등 base path 변경 감지 → 실패
│    ├─ secret-scan          gitleaks / GitHub secret scanning
│    ├─ permission-min       workflow 토큰 최소권한 lint
│    ├─ dependency-watch     Dependabot / lockfile diff 크기 게이트
│    └─ test-build-gate      pnpm -r test/typecheck/build 필수 통과
│
├─ (대기) 성장/디자인/CS 실  ◇v1.5+   playbook 문서로만 존재, 병목 생기면 agent 승격
│
└─ 앱별 제품 스쿼드 / Product Squads  = agent가 아니라 state+roadmap 파일 묶음
     ├─ zoopzoopcall (state/ + changelog/ + roadmap)
     ├─ runningcall  (동일)
     └─ pushrun      (동일)
```
범례: ● 매일 상시 · ○ 주간/월간 · ◇ 필요시 · ⚙️ 코드(CI) · ★ 사람

---

## 4. v1에서 실제로 유지할 최소 직원 (LLM subagent)

**"등록만 하는 명단"과 "실제 프롬프트를 유지보수하는 직원"을 구분하라.** v1에서 실제 프롬프트 파일을 만들고 유지할 직원은 **딱 이 6명**이다.

| # | 직원 | 주기 | 왜 필수인가 |
|---|---|---|---|
| 1 | **CEO / Orchestrator** | 매일 | 편성·우선순위 결정 없이는 아무것도 안 굴러감 |
| 2 | **App PM** | 매일 | "오늘 뭐 할지"를 acceptance까지 정의 |
| 3 | **Implementation Engineer** | 매일 | 실제 코드 변경 주체 |
| 4 | **QA Auditor** | 매일 | 변경이 test/build 깨는지 즉시 확인 |
| 5 | **Memory Librarian** | 매일 | state/changelog 부실 = 다음 실행이 맥락 상실 = 회사 치매 |
| 6 | **Agent Performance Reviewer** | 주간 | 자동화가 "스스로 발전"하게 만드는 유일한 루프. 이게 없으면 그냥 매일 코드 만지는 봇 |

- Chief of Staff는 **v1에선 CEO 프롬프트 안에 흡수**(별도 호출 아님). 앱이 5개 넘어 일정 충돌이 잦아지면 분리.
- Risk Auditor는 agent가 아니라 **CI 가드레일 + Reviewer의 주간 점검**으로 대체(7절).
- Release Manager는 **주간**만. 매일 릴리스 안 하므로 매일 호출 낭비.

> "12명 → 6명(매일 5·주간 1)"이 v1 정답. 초안의 12명은 v1.5 목표로 미룬다.

---

## 5. v1.5 / v2에서 추가할 직원

| 버전 | 추가 직원 | 승격 트리거(이게 충족돼야 승격) |
|---|---|---|
| v1.5 | Portfolio PM | 앱이 3개↑ 되고 "어느 앱부터?" 판단이 매주 흔들릴 때 |
| v1.5 | Release Manager (주간→상시화) | 릴리스 빈도가 주 2회↑ |
| v1.5 | Refactor Janitor | 기술부채 TODO가 앱당 10개↑ 쌓일 때 |
| v1.5 | UX/UI Designer | 실사용자 유입 시작되어 UI 피드백이 들어올 때 |
| v2 | Growth Marketer / Analytics Planner | 앱 하나라도 DAU 유의미해질 때 |
| v2 | CS Analyst | 사용자 문의 채널이 실제로 열릴 때 |
| v2 | Architect (상시화) | 앱 6개↑ 또는 공유 core 리팩토링 대공사 |
| v2 | Spec Writer | PM 혼자 스펙 품질이 안 나올 때 |

원칙: **없는 병목을 위해 직원을 미리 고용하지 않는다.** 각 직원은 "이 조건이면 채용"이라는 트리거를 문서에 박아둔다.

---

## 6. 매일 / 주간 / 월간 운영 루틴

### 매일 09:00 — Daily Company Run (GitHub Actions cron)
호출: CEO · App PM · Implementation Engineer · QA Auditor · Memory Librarian (5명)

1. `ops/state/*.md`, `ops/ROADMAP.md`, 각 앱 CHANGELOG의 `Next`, 최근 실패기록 읽기
2. 앱별 우선순위 점수 계산(9절 규칙) → **앱 1개 선택**
3. **목표 1개 선택 + 변경 가능 파일 범위 선언**(범위 밖 수정 금지)
4. 위험 점수 높으면 → 코드 수정 대신 **제안서(PR: proposal)**만 생성
5. Implementation Engineer가 범위 내 수정 → QA Auditor가 `pnpm -r test/typecheck/build`
6. **가드레일 CI 통과 필수**(base-path, secret, lockfile) — 실패 시 PR 자체를 막음
7. Memory Librarian이 CHANGELOG·state 갱신 → 버전후보 계산
8. `claude/daily-YYYY-MM-DD` 브랜치 커밋 → **PR 생성(draft)** → 설명에 결과/테스트/위험/다음작업
9. **사람 대표만 merge.**

> 하드 리밋: **하루 = 앱1 · 목표1 · PR1 · 직원≤5.** 초과하려면 사람이 명시 승인.

### 주 1회 — Weekly Management Review
호출: Agent Performance Reviewer · (Release Manager) · Memory Librarian
- 지난주 PR 품질/머지율/재작업률 평가, 반복 실패 원인, 모호했던 지시, 토큰 낭비, 금지작업 근접 사례
- 산출물: `ops/scorecards/agent-performance.md` 갱신 + **수정할 agent 프롬프트 목록**(이게 self-improvement의 핵심)

### 월 1회 — Monthly Board Review
호출: CEO · Portfolio PM · Architect
- 앱별 방향(키움/보류/리팩토링/폐기), MAJOR 후보, 신규 앱 추가 기준 점검

---

## 7. 보안 / 권한 / 비용 리스크 — "가드레일은 agent가 아니라 코드다"

이 절이 v0.3.0 대비 가장 큰 업그레이드다.

### 7-1. agent로 하지 말고 CI로 박을 것 (결정론적 = 확실 = 공짜)
| 초안의 "직원" | v0.4.0에서의 구현 | 근거 |
|---|---|---|
| Regression Guard | `base-path-guard` CI 테스트 (9절) | grep 한 줄이 LLM보다 100% 확실 |
| Secret Guard | GitHub secret scanning + gitleaks Action | 매 push 자동, 우회 불가 |
| Permission Controller | workflow `permissions:` 최소권한 + `pull-requests: write, contents: read` 고정 | 설정이지 판단이 아님 |
| Dependency Watcher | Dependabot + **lockfile diff 라인수 게이트**(예: 200줄↑ 변경 시 CI 실패) | 금지작업 #8 자동 차단 |
| 테스트 없이 배포 금지 | required status check로 test/build를 merge 필수조건화 | 금지작업 #12 자동 차단 |

**LLM에게 "secret 노출하지 마"라고 프롬프트로 부탁하는 것은 보안이 아니다.** secret scanning이 보안이다. agent는 실수할 수 있고, CI 검사는 실수하지 않는다.

### 7-2. 그래도 사람/agent가 지켜야 할 것
- **금지작업 12종**(초안 14절)은 유지. 단 실행 계층에서 강제: production secret·OAuth·prod DB·배포 workflow 변경은 **CODEOWNERS + 사람 승인 필수 경로**로 만들어 자동 merge 불가.
- Claude Code GitHub Action 토큰은 **`contents: write`가 아니라 브랜치 push + PR 생성까지만**. main 보호 규칙(branch protection)으로 직접 push 물리 차단.

### 7-3. 비용 리스크
- 가장 큰 낭비원: **매일 많은 직원 호출 + 긴 컨텍스트 재로딩.** → 매일 5명 상한, state 파일을 짧게(요약본) 유지.
- 두 번째: **실패 반복.** → Reviewer 주간 루프가 반복 실패의 원인 프롬프트를 잡아 비용 누수를 막음.
- 세 번째: **Agent Teams(상호통신 병렬)를 상시로 켜는 것.** → TF 전용, 월간/대공사에만.
- 측정: 주간 리뷰에 "이번 주 실행수 / 머지된 PR수 / 재작업 PR수"를 기록해 ROI를 눈으로 본다.

---

## 8. 모노레포 구조 보완안

### 8-1. 권장: holdings = 관제 저장소, 앱은 원본 저장소 유지 (모델 A)
```
zoop-holdings/                     # 코드 배포 안 함. ops·agents·workflow만.
  VERSION  CHANGELOG.md  README.md  CLAUDE.md  AGENTS.md
  ops/
    DESIGN.md  ROADMAP.md  DECISIONS.md  RISK_REGISTER.md
    state/      { holdings, zoopzoopcall, runningcall, pushrun }.md
    changelog/  { holdings, zoopzoopcall, runningcall, pushrun }.md
    scorecards/ { app-priority, agent-performance, weekly-review }.md
    playbooks/  { daily-routine, weekly-review, release-process,
                  base-path-check, rollback, security-boundaries,
                  new-app-onboarding, agent-performance-review }.md
    registry/   apps.yml            # 앱→저장소 URL·base path·배포방식 매핑 (10개 확장 지점)
  .claude/agents/                   # v1은 6개만 실제 존재 (4절)
  .github/workflows/                # daily-company-run · weekly-review · guardrails
```
- 앱 코드는 `zoopzoopcall` 저장소에 그대로. holdings의 daily-run이 **그 저장소를 checkout → 수정 → 그 저장소에 PR**.
- `ops/registry/apps.yml`이 앱 목록의 단일 소스. 앱 추가 = 여기에 한 줄 + state/roadmap 파일 생성.

### 8-2. 만약 코드를 실제로 넣어야 한다면 (모델 B, 절충)
- `zoop-holdings/apps/zoopzoopcall`를 **git submodule**로 `zoopzoopcall` 저장소에 핀. 단일 소스 유지, 배포는 원본에서. 서브모듈 커밋 핀 갱신만 holdings PR로.

### 8-3. 공통 개선 (어느 모델이든)
1. **`packages/core` 중복 제거.** `supabase/functions/notices`의 정규화 로직이 core와 복붙 동기화 중 → core를 Deno에서 import 가능한 형태로 노출하거나(예: `npm:`/JSR), 최소한 **골든마스터 스냅샷 테스트를 양쪽에 공유**해 표류를 CI가 감지하게. (지금은 "주석으로 부탁" 상태 = 시한폭탄)
2. **루트 공유 tsconfig base + ESLint/Prettier 도입.** 현재 각 패키지 tsconfig가 독립·중복. 앱 늘면 표준 없이 표류.
3. **core는 계속 raw TS 소비 유지**(빌드 없음)가 이식엔 유리. 단 앱마다 core를 복제하지 말고 **공유 1벌** 원칙 명문화.

---

## 9. base path "/zoopzoopcall/" 보호 전략

이게 "절대 안 깨지면 안 되는" 결정 #3의 실전 방어다.

### 9-1. 근본 방어(구조)
- **모델 A를 택하면 이 위험의 90%가 사라진다.** holdings가 앱을 배포하지 않으므로 URL을 바꿀 주체가 없다. `zoopzoopcall` 저장소의 `gh-pages` 배포는 지금 그대로.

### 9-2. CI 가드레일 (`base-path-guard`) — 반드시 추가
`zoopzoopcall` 저장소(또는 holdings의 앱 대상 CI)에 아래를 **required check**로:
```yaml
# .github/workflows/guardrails.yml (발췌)
- name: base-path must stay "/zoopzoopcall/"
  run: |
    grep -q 'base: *"/zoopzoopcall/"' apps/web/vite.config.ts \
      || { echo "::error::base path changed — blocking"; exit 1; }
```
- 확장판: `manifest.webmanifest`의 `start_url`/`scope`, `sw.js`의 캐시 경로도 같은 방식으로 앵커 체크.
- HashRouter라서 라우팅 404 폴백은 원래 불필요 — 이 사실을 playbook에 명시해 "SPA 폴백 추가" 같은 헛수정을 막는다.

### 9-3. 배포 스모크 (릴리스 전)
- `pnpm build` 후 `apps/web/dist/index.html`에 `/zoopzoopcall/` prefix 자산 경로가 실제로 박혔는지 grep 검증.
- rollback playbook: 이전 `gh-pages` 커밋으로 되돌리는 절차를 문서화(현재 배포가 `push -f`라 복구 절차가 특히 중요).

### 9-4. 금지작업으로 못 박기
- 금지작업 목록에 이미 있는 "#5 base path 변경 금지"를 **CODEOWNERS로 `vite.config.ts`·`manifest`·`sw.js`를 사람 승인 필수 파일**로 지정해 이중화.

---

## 10. 최종적으로 확정해야 할 결정 목록 (착수 전 필수)

착수(v1.0.0) 전에 아래를 **명시적으로 YES/NO** 못 박아야 한다. 미결정 상태로 시작하면 반드시 표류한다.

| # | 결정 사항 | 권장안 |
|---|---|---|
| D1 | 코드 물리 위치: 관제(A) / 서브모듈(B) / 복제(C) | **A (관제 저장소)** |
| D2 | 앱 목록 단일 소스 | `ops/registry/apps.yml` |
| D3 | v1 실제 agent 수 | **6명** (매일5·주간1) |
| D4 | 가드레일을 agent 아닌 CI로 구현 | **YES** (base-path/secret/lockfile/test) |
| D5 | 자동화 실행 기반 | GitHub Actions cron(안정) 중심, Routines는 실험 보조 |
| D6 | Claude Code 토큰 권한 | 브랜치 push + PR만. main branch protection 필수 |
| D7 | PATCH 자동 merge 허용? | **NO 유지(초기)** — 단 3개월 뒤 재검토 조건 명시 |
| D8 | base path 방어 | 모델A + `base-path-guard` CI + CODEOWNERS |
| D9 | core 중복(core↔supabase) 해소 방식 | 공유 스냅샷 테스트 or Deno import |
| D10 | 하루 작업 상한 | 앱1·목표1·PR1·직원≤5 (하드) |
| D11 | 신규 앱 온보딩 조건 | playbook `new-app-onboarding.md` 게이트 통과 시만 |
| D12 | Agent Performance Review 주기·산출물 | 주간, `agent-performance.md` + 프롬프트 수정목록 |

### D7 별도 검토 — "PATCH도 자동 merge 안 하는 게 너무 보수적인가?"
초기엔 **보수 유지가 맞다.** 이유: (a) 배포가 아직 수동 `push -f`라 자동 merge의 안전망(자동 롤백)이 없다. (b) 신뢰 데이터가 없다 — 몇 주 돌려봐야 agent PR 품질을 안다. **조건부 완화 로드맵**: "4주간 daily PR 머지율 ≥90% & 롤백 0건이면 → 문서/테스트 한정 PATCH에 auto-merge(required check 통과 전제) 도입" 을 D7에 함께 박아라. 지금 여는 건 이르다.

---

## 11. 검토 질문 14개 직답 (냉정 버전)

1. **회사1+중앙부서+스쿼드 맞나?** — 맞다. 단 "스쿼드"는 agent가 아니라 state/roadmap 파일 묶음으로.
2. **앱별 3개 쪼개기보다 확장성 좋나?** — 압도적으로 좋다. 규칙 1벌·중앙 재사용·앱당 파일만 추가.
3. **사장 직할실 충분한가?** — 개념은 필수. 단 4명 중 실동은 Memory Librarian(매일)+Performance Reviewer(주간) 2명이면 충분. Risk Auditor는 CI로, Chief of Staff는 CEO에 흡수.
4. **성과 리뷰 직원 실제 도움 되나?** — **가장 중요한 직원이다.** 이게 "봇"과 "스스로 발전하는 회사"를 가른다. 유지.
5. **직원 너무 많나? 누굴 남기나?** — 많다. 6명(4절)만 남겨라.
6. **매일 5명 상한 적절?** — 적절. 오히려 상한이자 목표. 하루 PR1 원칙과 함께 하드리밋으로.
7. **주간/월간 리뷰 과설계?** — 아니다. 장기 운영엔 필수. 단 매일 루틴만큼 무겁게 만들지 말 것(주간=1시간짜리).
8. **federated monorepo(apps/zoopzoopcall) 안전한가?** — 문자 그대로(복제 배포)면 **위험**. federation 단위를 저장소로 잡은 관제 모델(A)이면 안전. (2·8절)
9. **base path 보호 CI/playbook?** — `base-path-guard` grep 체크 + manifest/sw 앵커 체크 + 빌드 스모크 grep + rollback playbook + CODEOWNERS. (9절)
10. **PR-only 정책 충분히 안전?** — 필요조건이지 충분조건 아님. **branch protection(main 직접 push 물리 차단) + required checks**가 붙어야 완성.
11. **PATCH도 자동 merge 안 함, 너무 보수적?** — 지금은 아니다(맞는 보수). 4주 데이터로 조건부 완화. (D7)
12. **앱 10개 병목?** — (a) 매일 앱1 원칙이면 앱9는 매일 방치됨 → 앱별 "최소 주간 1회 touch" SLA 필요. (b) state/scorecard 읽기 컨텍스트 팽창 → 요약본 유지. (c) 사람 대표의 merge 리뷰가 병목 → 신뢰된 PATCH auto-merge로 완화. (d) 가드레일 CI 러닝타임/비용. 미리 registry+요약 state로 설계.
13. **누락된 실패모드?** — ①state 표류(다음 실행 맥락상실) ②core↔supabase 중복 표류 ③`push -f` 배포의 롤백 부재 ④agent가 범위 밖 파일 수정 ⑤빈 저장소(runningcall/pushrun)를 앱으로 착각해 헛작업 ⑥토큰 예산 상한 미설정 ⑦main branch protection 미설정 시 PR-only가 무력화. 전부 위 절에서 방어.
14. **착수 전 필수 결정?** — 10절 D1~D12.

---

## 부록 A. v1 착수 순서 (v1.0.0 로드맵)

1. `zoop-holdings` 저장소 생성(빈 관제 저장소).
2. `ops/` 뼈대 + `registry/apps.yml`(zoopzoopcall만 등록, runningcall/pushrun은 `status: stub`).
3. **가드레일 CI 먼저.** base-path-guard·secret-scan·test-gate. (조직보다 안전장치 먼저)
4. `zoopzoopcall` 저장소에 branch protection + required checks + CODEOWNERS 설정.
5. `.claude/agents/` 6개 프롬프트 작성.
6. `daily-company-run.yml`(cron 09:00, PR-only) 1개 앱(zoopzoopcall)만 대상으로 시범.
7. 2주 관측 → weekly-review로 프롬프트 교정 → 그다음 runningcall/pushrun 실구현 온보딩.
8. 4주 데이터로 D7(조건부 auto-merge) 재검토.

## 부록 B. 이번 리포트가 v0.3.0에서 바꾼 것 (diff 요약)
- 조직: **12명 → 실동6명**. 가드레일 4종을 **agent→CI로 강등**.
- 구조: "모노레포 안 모노레포(복제)" → **관제 저장소(모델 A)** 로 재정의(결정 #2·#3 자동 충족).
- 안전: base path 방어를 **CI grep + CODEOWNERS + 빌드 스모크**로 구체화.
- 부채: core↔supabase **중복 동기화**를 명시적 실패모드로 등록.
- 정책: PATCH auto-merge를 **조건부 완화 로드맵(4주 데이터)**으로 구체화.

---

*이 문서는 실제 `zoopzoopcall` 코드베이스 전수 조사(2026-07-09)에 근거한다. 목표는 "멋진 조직도"가 아니라, 개인 개발자가 여러 앱을 안전하게 자동 성장시키는 실제 운영 가능한 시스템이다.*
