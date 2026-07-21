# 청약봄 네이티브 앱

`apps/mobile`은 Expo SDK 57과 React Native 0.86으로 만든 Android·iOS 독립 프로젝트다. 웹 화면을 감싸지 않으며 공고 일정, 다음 행동, 관심 공고 로컬 알림, 청약홈 공식 링크만 네이티브 UI와 API로 제공한다.

## 앱 계약

- 앱 버전은 루트·코어와 동일한 `0.14.8`이다. (`app.json`·`package.json`이 일치해야 static 검증을 통과한다.)
- Android application ID와 iOS bundle identifier는 모두 `kr.robom.homebom`이다.
- custom scheme은 `homebom`이다.
- 공고 안정 ID는 웹 도메인 규칙과 같은 `HOUSE_MANAGE_NO-PBLANC_NO` 형식이며, 공유 코어 `@zoopzoopcall/core`가 발급한 값을 그대로 쓴다.
- 네이티브 관심 목록은 `homebom:native:interests:v1`, 마지막 확인본(LKG)은 `homebom:native:notices:lkg:v1`에 저장한다. 웹의 `zzc:*`/localStorage 키는 읽거나 쓰지 않는다.
- `expo-notifications`는 로컬 알림만 사용한다. Expo push token, FCM/APNs secret, 원격 발송 서버는 사용하지 않는다.

## 공고 데이터 소스

화면의 공고는 **실제 청약홈 공고**다. 앱은 웹과 같은 공개 프록시에서만 데이터를 불러오며, 데이터를 지어내지 않는다.

- 웹의 `VITE_NOTICES_URL`에 대응하는 `EXPO_PUBLIC_NOTICES_URL`에서만 실공고를 불러온다.
- Production 공개 프록시 URL(공개 함수, secret 아님): `https://neqjmxaneibobpedgsnl.supabase.co/functions/v1/notices`
- 응답 검증은 공유 코어 `@zoopzoopcall/core`의 `parseNoticeList`·`sanitizeNoticeUrls`·`Notice` 타입을 재사용한다.
- 활성 공고 조건은 웹과 동일: `cancelled !== true && Date.parse(receiptEnd) >= Date.now()`.
- 응답 헤더 `x-data-stale`(`1`이면 stale)·`x-verified-at`을 그대로 해석하고, 10초 안에 응답이 없으면 AbortController로 중단한다.
- 성공한 live 응답은 `homebom:native:notices:lkg:v1`에 마지막 확인본으로 저장(최대 72시간)하고, 오류·타임아웃 시 LKG(=stale)로, 없으면 not-connected로 떨어진다.
- `EXPO_PUBLIC_NOTICES_URL`이 없으면 데이터를 만들지 않고 "연결 준비 중" 상태로 남는다. build에서 이 값을 설정해야 실공고가 보인다.

## 로컬 실행

저장소 루트에서 의존성을 설치한다.

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @robom/homebom-mobile start:go
```

네이티브 development client를 사용할 때는 앱 디렉터리에서 실행한다.

```bash
cd apps/mobile
pnpm exec expo run:android
pnpm exec expo run:ios
pnpm start
```

로컬 알림은 Expo Go에서도 확인할 수 있지만 Android와 iOS 실제 기기의 권한 거부·재허용·재부팅 동작은 development 또는 preview build로 확인한다. Android 12 이상은 OS 정책에 따라 정확한 시각의 알림을 지연할 수 있다.

## 환경 변수

`EXPO_PUBLIC_APPLYHOME_NOTICE_URL`에는 공개된 청약홈 HTTPS 주소만 넣는다. 앱은 `applyhome.co.kr`이 아닌 주소를 무시하고 공식 공고 목록 URL로 되돌린다. `EXPO_PUBLIC_*` 값은 앱 번들에 공개되므로 secret을 넣으면 안 된다.

## 정적 검증

저장소 루트에서 아래 명령을 실행한다.

```bash
pnpm --filter @robom/homebom-mobile validate:config
pnpm --filter @robom/homebom-mobile expo:config
pnpm --filter @robom/homebom-mobile typecheck
pnpm dlx expo-doctor@latest apps/mobile
```

## EAS build와 스토어 제출 준비

EAS 명령은 모노레포 루트가 아니라 `apps/mobile`에서 실행한다. 이 저장소에는 development, preview, production profile만 준비되어 있으며 서명 파일과 store submit 자동 설정은 없다.

1. Expo 계정 소유자가 `pnpm dlx eas-cli@latest login`과 `pnpm dlx eas-cli@latest init`을 실행한다. 생성되는 공개 project ID만 검토해 app config에 반영하고 token이나 자격 증명은 커밋하지 않는다.
2. 실제 공고 데이터 연결, 최종 1024px 앱 아이콘, Android 알림 아이콘, 개인정보 처리방침과 지원 URL, 스토어 문구를 제품 소유자가 확인한다.
3. `pnpm dlx eas-cli@latest build --profile development --platform android` 또는 `--platform ios`로 실제 기기 흐름을 먼저 검증한다.
4. 내부 검수는 `preview`, 스토어용 산출물은 `production` profile로 빌드한다. iOS 인증서와 provisioning profile, Android keystore 생성·선택은 계정 소유자가 EAS 안내 화면에서 직접 승인한다.
5. production 산출물과 스토어 메타데이터를 승인한 뒤에만 계정 소유자가 `eas submit`을 별도로 실행한다. 이 프로젝트 설정은 자동 제출하지 않는다.

현재 작업에서는 EAS 초기화, 서명, secret 생성, production build, store 제출을 실행하지 않는다.
