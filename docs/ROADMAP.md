# ROADMAP

## v0.1.0 (완료) — 웹 PWA MVP

3종 공고 목록/상세 + 접수 시작·마감 카운트다운 + 알림 프리셋(로컬 알림) + 내 알림 + 테스트 알림.
core 순수함수 테스트 37건. GitHub Pages 배포(모바일 URL). 샘플 데이터 + 실데이터 연결 준비(프록시 코드 포함).

## v0.2.0 — 실데이터 + 서버 푸시

- 서비스키 발급 후 Supabase Edge Function `notices` 배포 → 실공고 전환.
- Supabase DB(notices, change_events, user_devices, alert_subscriptions) + `collect-notices` 폴링(접수 24h 이내 공고는 자주, 그 외 하루 2회) → 공고번호별 diff → change_events.
- 정정/취소/시간변경 시 Web Push(VAPID) 서버 푸시 + 클라이언트 재예약. 완전 종료 상태 알림 해결.
- `getRemndrLttotPblancMdl`로 주택형·공급금액 보강.

## v0.3.0 — 계정과 조건

- 로그인/기기 동기화, 관심 지역·평형·가격 조건 저장, 조건 매칭 공고만 자동 알림.

## v0.4.0 — 참고 정보

- 국토부 실거래가 공개 API로 "시세 대비" 참고 표시(단정 금지) + 단지 지도.

## v0.5.0 — 네이티브 앱 전환 준비

- Expo(React Native) 앱: packages/core 재사용, expo-notifications 로컬 예약 + Expo Push.
- 애드몹(개발 중 테스트 광고 ID → 승인 후 실광고), 앱명 상표 확인, 개인정보처리방침·약관·계정삭제.
- EAS 안드로이드 내부 빌드 → 실기기 확인.

## v0.6.0 — 추천/랭킹

- 인기·마감임박·지역별·유형별 정렬과 추천. 정정/취소는 추천보다 우선 노출 원칙 유지.

## v1.0.0 — 플레이스토어 정식 출시

- 안드로이드 정식 출시. 이후 iOS·웹 광고(애드센스) 확장 검토.
