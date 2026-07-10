# RISK REGISTER

| # | 위험 | 영향 | 방어 | 상태 |
|---|---|---|---|---|
| R1 | `/zoopzoopcall/` 배포 URL 깨짐 | 사용자 링크 사망 | 배포는 원본에서만 + base-path CI + CODEOWNERS | 방어중 |
| R2 | 복사본 ↔ 원본 갈라짐 | 코드 표류 | 원본 동결, 신규는 holdings | 관찰 |
| R3 | core ↔ supabase 정규화 중복 | 조용한 버그 | 공유 스냅샷 테스트(예정) | 열림 |
| R4 | 홍보 자동게시로 밴 | 브랜드 손상 | 초안만 자동, 게시는 사람 | 방어됨 |
| R5 | secret 노출 | 보안사고 | gitleaks + .env 커밋 금지 | 방어중 |
| R6 | AI 범위 밖 수정 | 예측불가 | 범위 선언 + inspector | 방어중 |
| R7 | main 직접 push | 무결재 반영 | branch protection(예정) | 열림 |
| R8 | 토큰 비용 폭주 | 비용 | 매일 5팀 상한 + state 요약 | 방어중 |
