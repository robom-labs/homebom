# DECISIONS — 확정 결정 로그

착수하며 내(마스터/설계리드)가 판단해 확정한 결정.

## 2026-07-09 · 착수 결정

### D1. 코드 물리 위치 = 관제 저장소(모델 A) + 개발용 앱 복사
- holdings는 관제(운영·자동화) 저장소. 앱 코드는 개발·기록용으로 복사, **배포는 원본에서만**.
- 이유: "폴더 복사해서 새 곳에서 시작" 요구를 지키면서 `/zoopzoopcall/` 라이브 URL을 깨지 않기 위함.
- 트레이드오프: 원본은 당분간 동결(freeze), 신규 개발은 holdings에서. 배포 이관은 별도 결정으로 미룸.

### D2. 루트 pnpm-workspace 두지 않음 (federated)
- 블로커: "모노레포 안 모노레포" — 루트 워크스페이스가 앱 자체 워크스페이스와 충돌.
- 결정: holdings 루트에 pnpm-workspace/package.json 두지 않음. 앱은 자기 폴더에서 독립 관리.

### D3. 가드레일 검사 경로 교정
- 블로커: `pnpm -r`는 루트에서 동작 안 함(루트 워크스페이스 없음). base-path 경로가 깊어짐.
- 결정: guardrails 의 test/build 를 `apps/zoopzoopcall` working-directory 로. base-path 검사는 `apps/zoopzoopcall/apps/web/vite.config.ts`.

### D4. 홍보 = 매일·다채널, 외부 게시는 사람 승인
- 자동 대량 게시(봇 댓글)는 스팸정책 위반·밴 위험 → 금지. 초안만 자동, 발행은 사장.

### D5. 버전 관리
- 시스템 버전: 루트 VERSION + CHANGELOG. 앱 버전: apps/<app>/package.json. 매 작업 PR로 저장, 버전 올리며 진행.

### D6. 저장소 생성 블로커 (2026-07-09)
- 통합 권한으로 새 GitHub 저장소 생성 불가(403). 임시로 산출물을 zoopzoopcall 브랜치 `zoop-holdings/` 에 저장.
- 해소: 사장이 빈 저장소 생성 → add_repo → 전체 push (START-STATUS.md).

## 열린 결정 (사장 확인 필요)
- D-open-1: 배포를 holdings로 이관? (이관 시 base path 전략 재확정)
- D-open-2: PATCH 자동 merge 시점(4주 데이터 후).
- D-open-3: 독립 저장소 생성 방식(사장 생성 / 권한 부여).
