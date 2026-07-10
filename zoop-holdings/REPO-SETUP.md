# zoop-holdings 저장소 생성 안내 (사장 30초 작업)

## 왜 이 문서가 필요한가
AI(나)는 **새 GitHub 저장소를 만들 권한이 없다**(API 403 — integration 권한 제한).
그래서 빈 저장소만 사장이 만들어주면, 내가 완성된 회사(3개 앱 + 관제)를 통째로 push한다.

## 지금 준비된 것 (로컬 완성본)
- 관제: CLAUDE.md, ops/(설계·결정·로드맵·리스크·registry·state·플레이북), .claude/agents/(11), .github/workflows/(4)
- 앱 3개 편입 완료:
  - apps/zoopzoopcall (줍줍콜, v0.1.0, Vite PWA)
  - apps/runningcall (러닝콜, v0.13.1, Next.js/Vercel)
  - apps/pushrun (PushRun, v0.6.6, 정적)
- 시스템 버전: 0.2.0

## 사장이 할 일 (택1)
### 방법 A — 빈 저장소 직접 생성 (권장, 30초)
1. GitHub → New repository
2. 이름: zoop-holdings / Private / README·gitignore·license 체크 안 함(빈 걸로)
3. Create
4. 나에게 "만들었어"라고 말하기 → 내가 add_repo 후 완성본 전체를 push하고 자동화를 켜다.

### 방법 B — 권한 부여
- 이 세션의 GitHub App/Integration에 repository 생성 권한을 부여 → 내가 직접 만든다.

## 저장소 생긴 뒤 내가 할 일 (자동)
1. add_repo runnerpyrri-lgtm/zoop-holdings
2. 로컬 완성본 push
3. ANTHROPIC_API_KEY secret 등록 요청(사장)
4. guardrails 동작 확인 → 첫 daily-company-run 수동 시범

## 안전
- 기존 3개 앱 저장소와 각자의 배포(Pages/Vercel)는 건드리지 않는다. holdings는 관제·개발 사본만.
