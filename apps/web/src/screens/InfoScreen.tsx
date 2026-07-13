// 설정과 앱 정보. 로봄 패밀리 공통 설정 UI 킷(야외봄 정본)을 청약봄 팔레트로 렌더한다.
// 구조: 브랜드 헤더+구분선 → 앱 소개 → 알림 권한 → 다른 로봄 앱 → 문의 → 데이터 출처 → 정책과 정보 → 앱 메타 카드.
import { useEffect, useState, type ReactNode } from "react";
import type { NoticeSource } from "../hooks/useNotices";
import packageInfo from "../../package.json";
import { AppHeader } from "../components/AppHeader";
import { notificationSupport, requestPermission } from "../notify/notifications";

const APP_VERSION = packageInfo.version;
const CONTACT = "hello.robom@gmail.com";
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || "local";
const PWA_CACHE = "zzc-v19";

function mailto(purpose: string): string {
  const subject = `[청약봄] ${purpose} 문의 · v${APP_VERSION}`;
  return `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}`;
}

// 폰 설정 딥링크(웹 최선책): Android Chrome 계열은 intent: URI로 일부 시스템 설정을 열 수 있다.
// 화면이 전환되지 않으면(비Android·미지원) 안내 폴백을 보여준다.
function openAndroidSetting(action: string, onFallback: () => void) {
  if (!/android/i.test(navigator.userAgent)) {
    onFallback();
    return;
  }
  const timer = window.setTimeout(onFallback, 1600);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) window.clearTimeout(timer);
    },
    { once: true },
  );
  window.location.href = `intent:#Intent;action=${action};end`;
}

// 패밀리 공통 20px 선 아이콘(1.9 라운드) — 야외봄 설정과 동일 계열.
function Ic({ d, extra }: { d: string; extra?: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
      {extra}
    </svg>
  );
}
const IC = {
  house: "M4 10.6 12 4l8 6.6v8.5a1 1 0 0 1-1 1h-4.7v-4.9a2.3 2.3 0 0 0-4.6 0v4.9H5a1 1 0 0 1-1-1Z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  spark: "M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.2l-1.8-5.6L4.5 10.8 10.2 9Z",
  shield: "M12 3.5 19 6v5.8c0 4.2-3 7.4-7 8.7-4-1.3-7-4.5-7-8.7V6Zm-2.8 8.2 2 2 3.6-3.9",
  file: "M7 3.5h7L19 8v12.5H7zM14 3.5V8h5M9.5 12.5h5M9.5 16h5",
  code: "m9 8-4.2 4L9 16m6-8 4.2 4L15 16",
  external: "M9 5H5v14h14v-4M14 4h6v6m0-6L10 14",
  chevron: "m9.5 6 6 6-6 6",
  bell: "M12 3a6 6 0 0 0-6 6v3.6l-1.6 3.2a.7.7 0 0 0 .63 1.02h13.94a.7.7 0 0 0 .63-1.02L18 12.6V9a6 6 0 0 0-6-6Zm-2.3 15.5a2.4 2.4 0 0 0 4.6 0",
  building: "M6 20.5V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15.5M4 20.5h16M9.5 8h1.6m3.4 0h-1.6M9.5 11.5h1.6m3.4 0h-1.6M9.5 15h1.6m3.4 0h-1.6",
  db: "M5 6.5c0-1.5 3.1-2.7 7-2.7s7 1.2 7 2.7-3.1 2.7-7 2.7-7-1.2-7-2.7Zm0 0v11c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7v-11M5 12c0 1.5 3.1 2.7 7 2.7s7-1.2 7-2.7",
} as const;

function CardHead({ icon, title, id }: { icon: string; title: string; id: string }) {
  return (
    <div className="settings-card-head">
      <span className="settings-chip" aria-hidden="true"><Ic d={icon} /></span>
      <h3 id={id}>{title}</h3>
    </div>
  );
}

type RowProps = { href: string; icon: string; title: string; sub?: string; badge?: string; newTab?: boolean };
function SettingsRow({ href, icon, title, sub, badge, newTab = true }: RowProps) {
  return (
    <a className="settings-row" href={href} {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}>
      <span className="settings-row-icon" aria-hidden="true"><Ic d={icon} /></span>
      <span><strong>{title}</strong>{sub && <small>{sub}</small>}</span>
      {badge ? <em>{badge}</em> : <span className="settings-row-go" aria-hidden="true"><Ic d={IC.chevron} /></span>}
    </a>
  );
}

export function InfoScreen({ source }: { source: NoticeSource }) {
  // notificationSupport()가 "unsupported" 또는 현재 권한 문자열을 반환한다 — Notification 전역을
  // 직접 읽으면 미지원 브라우저(아이폰 사파리 탭 등)에서 ReferenceError로 설정 화면 전체가 죽는다.
  const [permission, setPermission] = useState<string>(() => notificationSupport());
  const [guide, setGuide] = useState<string | null>(null);

  // 폰 설정에서 권한을 바꾸고 돌아온 경우 화면 문구를 실제 권한 상태와 다시 맞춘다.
  useEffect(() => {
    const sync = () => setPermission(notificationSupport());
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const permissionLabel =
    permission === "granted"
      ? "알림이 켜져 있어요."
      : permission === "denied"
        ? "알림이 차단돼 있어요. 폰 설정에서 허용으로 바꿔주세요."
        : permission === "unsupported"
          ? "이 브라우저는 알림을 지원하지 않습니다."
          : "알림 권한을 아직 요청하지 않았어요.";

  return (
    <div className="screen settings-screen">
      <AppHeader source={source} />

      <section className="settings-card" aria-labelledby="about-homebom">
        <CardHead icon={IC.building} title="청약봄은" id="about-homebom" />
        <p className="settings-note">
          일반공급·특별공급·순위별 접수와 무순위·잔여세대·불법행위 재공급 일정을 함께 챙기는 알림
          서비스입니다.
        </p>
        <p className="settings-note">
          청약 신청과 자격 확인은 언제나{" "}
          <a href="https://www.applyhome.co.kr" target="_blank" rel="noreferrer">청약홈(applyhome.co.kr)</a>
          에서 직접 진행하셔야 합니다.
        </p>
      </section>

      <section className="settings-card" aria-labelledby="notify-env">
        <CardHead icon={IC.bell} title="알림 권한" id="notify-env" />
        <p className="settings-note">{permissionLabel}</p>
        <p className="settings-note">
          알림은 앱이 실행 중일 때 동작해요. 아이폰은 홈 화면에 추가한 아이콘(사파리 공유 → 홈
          화면에 추가)으로 열어야 알림을 받을 수 있어요.
        </p>
        <div className="settings-deeplinks">
          {/* denied 상태의 requestPermission()은 대부분 브라우저에서 no-op — 그때는 폰 설정 안내만 남긴다. */}
          {permission === "default" && (
            <button
              type="button"
              className="primary-action"
              onClick={() => void requestPermission().then((p) => setPermission(p))}
            >
              알림 켜기
            </button>
          )}
          <button
            type="button"
            className="ghost-action"
            onClick={() =>
              openAndroidSetting("android.settings.APP_NOTIFICATION_SETTINGS", () =>
                setGuide("폰 설정 → 애플리케이션 → 사용 중인 브라우저(또는 청약봄) → 알림에서 허용으로 바꿔주세요."),
              )
            }
          >
            폰 알림 설정 열기
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() =>
              openAndroidSetting("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS", () =>
                setGuide("폰 설정 → 배터리 → 배터리 최적화(앱 절전)에서 사용 중인 브라우저를 예외로 지정하면 알림 지연이 줄어요."),
              )
            }
          >
            배터리 예외 설정 열기
          </button>
        </div>
        {guide && <p className="settings-note settings-guide" role="status">{guide}</p>}
      </section>

      <section className="settings-card" aria-labelledby="family-apps">
        <CardHead icon={IC.house} title="다른 로봄 앱" id="family-apps" />
        <SettingsRow href="https://robom.kr/apps/outbom" icon={IC.house} title="야외봄" sub="날씨·대기질로 나가기 좋은 시간 알림" badge="웹으로 이용" />
        <SettingsRow href="https://robom.kr/apps/runningbom" icon={IC.house} title="러닝봄" sub="러닝 대회 접수 시작·마감 알림" badge="웹으로 이용" />
        <SettingsRow href="https://robom.kr" icon={IC.external} title="로봄 홈페이지" sub="robom.kr" />
      </section>

      <section className="settings-card" aria-labelledby="contact-settings">
        <CardHead icon={IC.mail} title="문의" id="contact-settings" />
        <SettingsRow href={mailto("일반")} icon={IC.mail} title="일반 문의" sub={CONTACT} newTab={false} />
        <SettingsRow href={mailto("광고·제휴")} icon={IC.spark} title="광고·제휴 문의" sub="앱명·용도·버전이 제목에 포함돼요." newTab={false} />
      </section>

      <section className="settings-card" aria-labelledby="data-source">
        <CardHead icon={IC.db} title="데이터 출처" id="data-source" />
        <p className="settings-note">
          공공데이터포털의 <strong>한국부동산원 청약홈 분양정보 조회 서비스</strong>를 사용합니다.
          {source === "not-connected" && <> 실공고 연결이 완료되지 않은 상태에서는 임의 공고를 표시하지 않습니다.</>}
          {" "}접수 일정은 정정 공고로 바뀔 수 있으니 신청 전 모집공고 원문을 확인하세요. 청약봄은 당첨
          가능성이나 자격을 판정하지 않습니다.
        </p>
      </section>

      <section className="settings-card" aria-labelledby="legal-settings">
        <CardHead icon={IC.shield} title="정책과 정보" id="legal-settings" />
        <SettingsRow href="https://robom.kr/privacy/homebom" icon={IC.shield} title="개인정보처리방침" />
        <SettingsRow href="https://robom.kr/terms" icon={IC.file} title="이용약관" />
        <SettingsRow href="https://github.com/robom-labs/homebom" icon={IC.code} title="오픈소스 라이선스" />
      </section>

      <section className="app-meta-card" aria-label="앱 정보">
        <span className="app-meta-icon" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}icons/icon-v2.svg`} alt="" width="30" height="30" />
        </span>
        <div>
          <strong>청약봄</strong>
          <small>개발자 · 로봄</small>
          <small className="app-build">빌드 {BUILD_SHA.slice(0, 7)} · PWA {PWA_CACHE} · 데이터 한국부동산원 청약홈</small>
        </div>
        <span className="app-version">v{APP_VERSION}</span>
      </section>
    </div>
  );
}
