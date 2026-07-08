# CHANGELOG

이 프로젝트는 [SemVer](https://semver.org/lang/ko/)를 따른다.

## [0.1.0] - 2026-07-08

### 추가

- `packages/core`: Notice 도메인 타입, 상태 판정(`getNoticeStatus`/`isClosingSoon`), KST D-day·표기·남은시간(`ddayKst`/`formatKstDateTime`/`formatRemaining`/`formatManwon`), 알림 계산(`buildNoticeAlerts`, 시작 [1일·3시간·정각] / 마감 [1일·3시간·1시간] 프리셋, 과거 미예약), 청약홈 API(15098547) 실측 스펙 정규화(`normalizeRemndrItems`). Vitest 테스트 31건 + 골든마스터.
- `apps/web`: React+Vite PWA. 공고 목록(유형·지역·접수중 필터, 접수중/예정/마감 그룹), 상세(1초 카운트다운, 알림 프리셋 토글, 청약홈 딥링크), 내 알림(예약 목록·5초 테스트 알림·권한 안내), 안내 화면. 로컬 알림 스케줄러(15초 폴링+화면복귀 체크, 발송 이력 중복 방지). 서비스워커(오프라인 셸 캐시, 알림 클릭 → 청약홈). 도장 스탬프 D-day·공고문 종이 디자인, 라이트/다크, 반응형, 접근성(포커스·모션 최소화).
- `supabase/functions/notices`: 서비스키를 서버에 숨기는 청약홈 API 프록시(10분 캐시, JSON 정규화). 배포 절차는 DEPLOY 문서.
- PWA 아이콘 생성 스크립트(외부 의존성 없는 PNG 인코더), 매니페스트, GitHub Pages 배포.
- 문서 6종 + docs/superpowers specs/plans v0.1.0 페어.

### 설계 결정

- v0.1.0 플랫폼을 Expo 네이티브 대신 **웹 PWA 우선**으로 조정: 사람 개입 없이 즉시 접속 가능한 모바일 URL 제공이 목표였고, EAS 빌드·스토어 등록은 계정·수동 절차가 필요하기 때문. Expo 앱·애드몹은 로드맵 후속 버전으로 이동 (근거: docs/DEVELOPMENT_LOG.md).
- 실데이터는 서비스키 발급(사람 몫) 전까지 샘플 공고로 대체하고, 화면에 샘플임을 명시.
