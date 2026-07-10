# zoop-holdings

1인 지주회사 — 여러 앱을 **매일 스스로 개선·홍보**하는 자동 운영 회사.

- **본사(관제)**: 이 저장소. 운영 장부(`ops/`) + AI 직원(`.claude/agents/`) + 자동화(`.github/workflows/`).
- **제품(앱)**: `apps/` 아래. 각 앱은 독립 워크스페이스(federated). 현재 `zoopzoopcall`(live).
- **결재**: 모든 변경은 PR로. main merge·배포·비밀키·큰 변경은 **사람(사장)**이 승인.

## 조직 (요약)
- **매일**: 마스터 + 실행 4팀(기획·개발·검사·기록) + 홍보 1팀 → 코드 PR + 콘텐츠 PR
- **주간**: 개선 엔진(감독·R&D·릴리즈)
- **월간**: 전략·설계
- **상시**: 안전 레일(CI) — base-path·secret·test·lockfile

자세한 설계는 `ops/DESIGN.md`, 확정 결정은 `ops/DECISIONS.md`, 구조는 `STRUCTURE.md`.

## 버전
- 시스템 버전: `VERSION`(현재 0.1.0) — 회사 운영 방식/자동화 변경 시 bump.
- 앱 버전: `apps/<app>/package.json` — 앱 기능 변경 시 bump.

## 원칙
- 하루 = 앱 1개 · 목표 1개 · PR 1개.
- 기존 `zoopzoopcall` 저장소와 `/zoopzoopcall/` 배포 URL은 건드리지 않는다.
- 홍보 콘텐츠는 매일 자동 생성, **외부 게시는 사람 승인**(스팸 금지).
