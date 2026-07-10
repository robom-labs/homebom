# 착수 상태 (2026-07-09)

> zoop-holdings 회사를 실제로 시작한 기록. 이 폴더는 컨테이너 유실 방지를 위해 브랜치에 저장한다.

## 지금까지 한 것 (로컬 /home/user/zoop-holdings 에 완성)
- 관제 저장소 스캐폴드 전체 구성: `ops/`, `.claude/agents/`(11), `.github/workflows/`(4), `CLAUDE.md`, `README`, `VERSION(0.1.0)`.
- `apps/zoopzoopcall` 로 기존 앱을 federated 복사(원본 저장소·`/zoopzoopcall/` 배포 불변).
- 발견한 블로커 3개 판단·해결 → `ops/DECISIONS.md`(D2 루트 워크스페이스 제거, D3 가드레일 경로 교정).

## 이 폴더에 저장된 것
착수하며 새로 저작한 파일(결정·로드맵·리스크·상태·교정된 가드레일).
agent/workflow/playbook 본체는 `docs/zoop-holdings/blueprint/` 와 동일하므로 중복 저장하지 않음.
저장소 분리 시 blueprint + 이 폴더 + 앱을 합쳐 새 저장소로 옮긴다.

## 막힌 것 (사장 결정 필요)
- **별도 GitHub 저장소 `zoop-holdings` 생성 권한이 없음(API 403).** git 접근도 zoopzoopcall 로 스코프됨.
- 자동화 워크플로는 **저장소 루트의 `.github/` 에서만** 실행됨 → 매일 자동운영을 실제로 돌리려면 zoop-holdings 가 **독립 저장소**여야 함.

## 완료 절차 (택1)
1. **(권장)** 사장이 GitHub에서 빈 저장소 `zoop-holdings` 생성 → 세션에 add_repo → 로컬 스캐폴드 전체 push. 이후 매일 자동운영 가동.
2. 임시로 이 저장소 안 `zoop-holdings/` 폴더로 계속 개발·버전관리(자동 실행은 보류).
