# TODO

## 사람이 해야 하는 것 (Claude Code가 대신 못 함)

- [x] 공공데이터포털 청약홈 API(15098547) 서비스키 연결.
- [x] Supabase Edge Function `notices`와 일반공급 주택형 서버 캐시 배포.
- [x] GitHub Pages 프로덕션 번들에 공개 함수 URL 연결.
- [ ] (v0.5.0 대비) 구글 계정으로 애드몹 가입, 플레이스토어 개발자 등록($25).

## v0.1.0 후속 개선 후보

- [ ] 실기기(안드로이드 크롬/아이폰 사파리 PWA)에서 알림 수신 확인 및 스크린샷 기록.
- [ ] 접수 시각이 공고별로 다른 경우 대응(현재는 09:00~17:30 KST 가정) — Mdl 오퍼레이션/공고 원문 확인.
- [ ] 웹 스케줄러/스토어(apps/web) 단위 테스트 추가 (핵심 계산은 core에서 테스트 완료).
- [ ] 라이트하우스 점검(PWA 설치 가능성·성능·접근성).

## v0.2.0

- [ ] Supabase migrations: notices, change_events, profiles, user_devices, alert_subscriptions (+RLS).
- [ ] collect-notices 함수(폴링 주기 차등 + diff + change_events).
- [ ] Web Push(VAPID) 구독·발송(send-notice-push) + 정정/취소 재예약.
