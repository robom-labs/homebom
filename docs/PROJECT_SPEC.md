# 줍줍콜 PROJECT_SPEC

## 한 줄 정의

무순위 줍줍 접수가 열리고 닫히는 순간을, 내 조건에 맞는 것만 폰으로 미리 울려준다.

## 대상

무순위 청약을 노리지만 청약홈을 매번 못 뒤지고, 접수 시작/마감을 놓쳐 후회하는 사람.

## 범위 (v0.1.0)

- 공고 3종 통합: 무순위 + 잔여세대 + 취소후재공급.
- 목록(유형·지역·접수중 필터) / 상세(카운트다운·알림 프리셋·청약홈 딥링크) / 내 알림 / 안내.
- 알림: 로컬(브라우저) 알림. 시작 프리셋 [1일 전, 3시간 전, 정각], 마감 프리셋 [1일 전, 3시간 전, 1시간 전].
- 데이터: 청약홈 API(공공데이터포털 15098547) — 서비스키 연결 전에는 샘플 공고(화면에 명시).

## 데이터 소스 (실측 확정)

- 엔드포인트: `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancDetail`
- 파라미터: `page`, `perPage`, `returnType=JSON`, `serviceKey`, `cond[...]` 조건 검색.
- `HOUSE_SECD`: **04 = 무순위, 06 = 불법행위 재공급(취소후재공급)**. 잔여세대는 `HOUSE_SECD_NM`의 "잔여" 포함 여부로 판별.
- 주요 필드: `HOUSE_MANAGE_NO`, `PBLANC_NO`, `HOUSE_NM`, `SUBSCRPT_AREA_CODE_NM`, `HSSPLY_ADRES`, `TOT_SUPLY_HSHLDCO`, `RCRIT_PBLANC_DE`, `SUBSCRPT_RCEPT_BGNDE/ENDDE`, `PRZWNER_PRESNATN_DE`, `PBLANC_URL`.
- 접수일은 날짜만 제공 → 기본 시각 **09:00 ~ 17:30 KST**를 적용한다(청약홈 통상 접수시간). 이 가정은 normalize에 상수로 명시.
- 공급금액은 이 오퍼레이션에 없음 → `priceMin/Max`는 optional, v0.2.0에서 `getRemndrLttotPblancMdl`로 보강.
- 크롤링·검수큐·신뢰도·제보 파이프라인은 만들지 않는다(공식 API이므로 불필요).

## 도메인 모델

`packages/core/src/notice/types.ts`의 `Notice`가 단일 진실. 상태는 저장하지 않고 `getNoticeStatus(notice, now)`로 파생한다.

- 취소 → "취소" / 시작 전 → 정정이면 "정정", 아니면 "예정" / 기간 중 → "접수중" / 종료 후 → "마감".
- `corrected`는 접수중에도 배지로 노출한다.

## 알림 설계

- `buildNoticeAlerts(notice, kind, offsets, now)` 순수함수. 과거 시각(fireAt ≤ now)은 예약하지 않는다. 테스트+골든마스터로 잠금.
- 알림 ID는 `noticeId:kind:offset`으로 결정적 — 발송 이력(localStorage)과 대조해 중복 발송을 막는다.
- 스케줄러: 15초 폴링 + visibilitychange 시 즉시 확인. 6시간 넘게 지난 미발송 알림은 버린다.
- v0.1.0 한계(화면에 명시): 브라우저/PWA가 실행 중일 때만 울린다. 서버 푸시는 v0.2.0.

## 반드시 지킬 원칙

1. 알림 시간 계산은 순수함수 + 테스트. 과거 시각 예약 금지.
2. 시간은 저장 UTC, 표시는 Asia/Seoul.
3. 접수 시간은 정정될 수 있다는 전제로 설계.
4. "받을 수 있다/당첨된다" 단정 금지 — 항상 "청약홈에서 확인" 톤.
5. 신청은 우리가 하지 않는다 — 청약홈 공식 딥링크만.
6. 알림 권한 없음을 숨기지 않고 크게 안내.
7. 정정/취소는 일반 노출보다 우선.
8. 서비스키는 서버(Edge Function)에서만. 앱 번들·URL 노출 금지.
9. 광고는 핵심 정보를 가리지 않게 배치(광고 도입 버전부터).
10. 매 버전 CHANGELOG·ROADMAP·docs/superpowers 갱신.
11. 개인정보 최소 수집.

## 비목표 (YAGNI)

- 청약 자격/당첨 자동 판정 단정.
- 크롤링 adapter, source_snapshots, 검수 큐, sourceConfidence, 관리자 수동입력, 사용자 제보.
- 대리 신청, 청약통장 연계, 지도 스크래핑.

## 원본 대비 조정 (결정 기록)

부트스트랩 프롬프트는 v0.1.0을 Expo 네이티브 앱으로 정의했으나, "사람 개입 없이 완성하고 즉시 접속 가능한 모바일 주소 제공"이라는 이번 실행의 최우선 요구와 충돌했다(EAS 빌드·스토어는 계정·수동 절차 필요). 따라서 **v0.1.0은 웹 PWA로 출시**하고 Expo+애드몹은 로드맵 후속으로 옮겼다. 도메인 로직은 전부 `packages/core` 순수함수라 네이티브 전환 시 그대로 재사용된다. 상세 근거: DEVELOPMENT_LOG 2026-07-08.
