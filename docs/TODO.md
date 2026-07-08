# TODO

## 사람이 해야 하는 것 (Claude Code가 대신 못 함)

- [ ] 공공데이터포털에서 청약홈 API(15098547) 활용신청 → 서비스키 발급 (무료, 즉시승인).
- [ ] Supabase 무료 프로젝트 생성 → `supabase functions deploy notices` + `supabase secrets set DATA_GO_KR_SERVICE_KEY=...` (절차: DEPLOY.md).
- [ ] 배포된 함수 URL을 `apps/web/.env`의 `VITE_NOTICES_URL`에 넣고 재빌드·재배포 → 실공고 전환.
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
