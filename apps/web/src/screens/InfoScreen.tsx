// 설정 화면에서 패밀리 앱·PWA 설치·지원·개인정보·앱 메타를 한 흐름으로 제공한다.
import { useEffect, useState } from "react";
import type { NoticeSource } from "../hooks/useNotices";
import packageInfo from "../../package.json";
import familyMeta from "../generated/robom-family/app-meta.json";
import { AppHeader } from "../components/AppHeader";
import { notificationSupport, requestPermission } from "../notify/notifications";
import {
  analyticsConsentGranted,
  analyticsEndpointConfigured,
  setAnalyticsConsent,
} from "../analytics/familyAnalytics";
import { usePwaInstall } from "../pwa/PwaInstallProvider";

const APP_VERSION = packageInfo.version;
const CONTACT = "hello.robom@gmail.com";
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || "local";
const PWA_CACHE = "zzc-v" + APP_VERSION;
const DATA_VERSION = "한국부동산원 청약홈 공고";

const APP_DESCRIPTIONS: Record<string, string> = {
  outbom: "날씨·대기질로 야외 활동 시간을 고르는 앱",
  homebom: "공고·접수·발표·계약 일정을 챙기는 앱",
  runningbom: "러닝 대회 접수 시작·마감을 챙기는 앱",
  certbom: "조건에 맞는 자격증과 시험 일정을 찾는 앱",
};

function mailto(purpose: string): string {
  const subject = "[청약봄] " + purpose + " 문의 · v" + APP_VERSION;
  return "mailto:" + CONTACT + "?subject=" + encodeURIComponent(subject);
}

function formatVerifiedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

// 폰 설정 딥링크(웹 최선책): Android Chrome 계열은 intent URI로 일부 시스템 설정을 열 수 있다.
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
  window.location.href = "intent:#Intent;action=" + action + ";end";
}

function Ic({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
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
  install: "M12 3v12m-5-5 5 5 5-5M4 19v2h16v-2",
  refresh: "M20 7v5h-5M4 17v-5h5m9.7-3A8 8 0 0 0 5.2 7M5.3 15A8 8 0 0 0 18.8 17",
  accessibility: "M12 4.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 7h16m-8 0v14m0-9-5 9m5-9 5 9",
} as const;

function CardHead({ icon, title, id }: { icon: string; title: string; id: string }) {
  return (
    <div className="settings-card-head">
      <span className="settings-chip" aria-hidden="true"><Ic d={icon} /></span>
      <h2 id={id}>{title}</h2>
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return <div className="app-meta-row"><dt>{label}</dt><dd>{value}</dd></div>;
}

export function InfoScreen({ source }: { source: NoticeSource }) {
  const [permission, setPermission] = useState<string>(() => notificationSupport());
  const [guide, setGuide] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [analyticsConsent, setAnalyticsConsentState] = useState(analyticsConsentGranted);
  const pwa = usePwaInstall();
  const analyticsReady = analyticsEndpointConfigured();

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

  const onUpdate = async () => {
    setUpdateStatus("업데이트를 확인하고 있어요…");
    const outcome = await pwa.checkForUpdate();
    const messages = {
      checked: "업데이트 확인을 마쳤습니다. 새 버전은 자동으로 적용돼요.",
      ready: "새 버전을 적용하고 있어요. 잠시 뒤 화면이 새로 열립니다.",
      unsupported: "이 브라우저에서는 자동 업데이트 확인을 지원하지 않아요.",
      failed: "지금은 업데이트를 확인할 수 없어요. 네트워크 연결 후 다시 시도해 주세요.",
    } as const;
    setUpdateStatus(messages[outcome]);
  };

  const toggleAnalytics = () => {
    const next = !analyticsConsent;
    if (setAnalyticsConsent(next)) setAnalyticsConsentState(next);
  };

  return (
    <div className="screen settings-screen">
      <AppHeader source={source} />

      <section className="settings-card" aria-labelledby="about-homebom">
        <CardHead icon={IC.building} title="청약봄은" id="about-homebom" />
        <p className="settings-note">
          일반공급·특별공급·순위별 접수와 무순위·잔여세대·불법행위 재공급의 공고·접수·발표·계약 일정을 함께 챙기는 서비스입니다.
        </p>
        <p className="settings-note">로그인 없이 사용할 수 있고, 알림 설정은 이 기기에만 저장됩니다.</p>
        <p className="settings-note">
          청약 신청과 자격 확인은 언제나 <a href="https://www.applyhome.co.kr" target="_blank" rel="noreferrer">청약홈(applyhome.co.kr)</a>에서 직접 진행하셔야 합니다.
        </p>
        <p className="settings-note">청약 정보는 정정될 수 있으니, 신청 전 청약홈에서 최종 내용을 한 번 더 확인해 주세요.</p>
      </section>

      <section className="settings-card" aria-labelledby="notify-env">
        <CardHead icon={IC.bell} title="알림 권한" id="notify-env" />
        <p className="settings-note">{permissionLabel}</p>
        <p className="settings-note">알림은 앱이 실행 중일 때 동작해요. 아이폰은 홈 화면에 추가한 청약봄 아이콘으로 열어야 알림을 받을 수 있어요.</p>
        <div className="settings-deeplinks">
          {permission === "default" && (
            <button type="button" className="primary-action" onClick={() => void requestPermission().then((value) => setPermission(value))}>
              알림 켜기
            </button>
          )}
          <button
            type="button"
            className="ghost-action"
            onClick={() => openAndroidSetting("android.settings.APP_NOTIFICATION_SETTINGS", () => setGuide("폰 설정 → 애플리케이션 → 사용 중인 브라우저(또는 청약봄) → 알림에서 허용으로 바꿔주세요."))}
          >
            폰 알림 설정 열기
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => openAndroidSetting("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS", () => setGuide("폰 설정 → 배터리 → 배터리 최적화에서 사용 중인 브라우저를 예외로 지정하면 알림 지연이 줄어요."))}
          >
            배터리 예외 설정 열기
          </button>
        </div>
        {guide && <p className="settings-guide" role="status">{guide}</p>}
      </section>

      <section className="settings-card" aria-labelledby="accessibility-settings">
        <CardHead icon={IC.accessibility} title="화면과 접근성" id="accessibility-settings" />
        <p className="settings-note">기기의 글자 크기와 브라우저 확대를 따르며, 주요 버튼과 하단 메뉴는 손가락으로 누르기 쉬운 크기를 유지합니다.</p>
      </section>

      <section className="settings-card" aria-labelledby="update-section">
        <CardHead icon={IC.refresh} title="업데이트" id="update-section" />
        <p className="settings-note">청약봄은 접속할 때마다 최신 버전으로 유지돼요. 새 버전은 앱을 다시 열 때 안전하게 갱신됩니다.</p>
        <div className="settings-deeplinks">
          <button type="button" className="ghost-action" onClick={() => void onUpdate()}><Ic d={IC.refresh} />업데이트 확인</button>
        </div>
        {updateStatus && <p className="settings-guide" role="status">{updateStatus}</p>}
      </section>

      <section className="settings-card" aria-labelledby="data-source">
        <CardHead icon={IC.db} title="데이터 출처와 확인 시각" id="data-source" />
        <p className="settings-note">
          공공데이터포털의 <strong>한국부동산원 청약홈 분양정보 조회 서비스</strong>와 공식 모집공고문을 사용합니다.
          {source === "not-connected" && <> 실공고 연결이 완료되지 않은 상태에서는 임의 공고를 표시하지 않습니다.</>}
          {source === "stale" && <> 현재는 마지막 검증본을 보여드리고 있습니다.</>}
        </p>
        <p className="settings-note">패밀리 정본 마지막 확인 {formatVerifiedAt(familyMeta.lastVerifiedAt)}. 신청 전 모집공고 원문을 확인하세요.</p>
      </section>

      <section className="settings-card" aria-labelledby="family-apps">
        <CardHead icon={IC.house} title="로봄 패밀리 앱 3개" id="family-apps" />
        {familyMeta.familyApps.filter((app) => app.id !== "homebom").map((app) => (
          <SettingsRow
            key={app.id}
            href={app.installUrl}
            icon={IC.house}
            title={app.name}
            sub={(APP_DESCRIPTIONS[app.id] || "로봄 패밀리 앱") + " · 2026년 8월 초 출시 예정"}
            badge="준비 중"
          />
        ))}
      </section>

      <section className="settings-card" aria-labelledby="support-settings">
        <CardHead icon={IC.mail} title="지원과 의견 보내기" id="support-settings" />
        <SettingsRow href={familyMeta.supportUrl} icon={IC.external} title="지원 센터" sub="사용 방법과 자주 묻는 질문" />
        <SettingsRow href={mailto("일반")} icon={IC.mail} title="일반 문의" sub={CONTACT} newTab={false} />
        <SettingsRow href={mailto("오류·정보 정정")} icon={IC.spark} title="오류·정보 정정" sub="앱 버전이 메일 제목에 포함돼요." newTab={false} />
      </section>

      <section className="settings-card" aria-labelledby="privacy-settings">
        <CardHead icon={IC.shield} title="개인정보와 공식 안내" id="privacy-settings" />
        <SettingsRow href={familyMeta.privacyUrl} icon={IC.shield} title="개인정보처리방침" sub="수집 항목과 이용 목적" />
        <SettingsRow href="https://robom.kr/terms" icon={IC.file} title="이용약관" sub="서비스 이용 조건" />
        <SettingsRow href="https://www.applyhome.co.kr" icon={IC.external} title="청약홈 공식 사이트" sub="신청·자격 확인·최신 공고" />
        <SettingsRow href="https://github.com/robom-labs/homebom" icon={IC.code} title="오픈소스와 라이선스" sub="소스 코드와 사용한 소프트웨어" />
        <div className="analytics-consent">
          <strong>익명 사용 개선 데이터</strong>
          <p role="status">
            {!analyticsReady
              ? "현재 수집 서버가 연결되지 않아 어떤 사용 데이터도 전송하지 않습니다."
              : analyticsConsent
                ? "개인정보 없는 핵심 행동 전송을 허용했습니다. 언제든 끌 수 있어요."
                : "기본값은 꺼짐이며, 동의하기 전에는 어떤 사용 데이터도 보내지 않습니다."}
          </p>
          {analyticsReady && (
            <button type="button" className="ghost-action" aria-pressed={analyticsConsent} onClick={toggleAnalytics}>
              {analyticsConsent ? "익명 데이터 전송 끄기" : "익명 데이터 전송 허용"}
            </button>
          )}
        </div>
      </section>

      <section className="settings-card settings-card--meta" aria-labelledby="app-meta-settings">
        <CardHead icon={IC.code} title="앱 정보" id="app-meta-settings" />
        <dl className="app-meta-list">
          <MetaRow label="앱 이름" value={familyMeta.name + " · " + familyMeta.englishName} />
          <MetaRow label="버전" value={APP_VERSION} />
          <MetaRow label="빌드 SHA" value={BUILD_SHA.slice(0, 7)} />
          <MetaRow label="패밀리 규격" value={familyMeta.familySpecVersion} />
          <MetaRow label="서비스 워커 캐시" value={PWA_CACHE} />
          <MetaRow label="데이터 버전" value={DATA_VERSION} />
          <MetaRow label="마지막 확인" value={formatVerifiedAt(familyMeta.lastVerifiedAt)} />
          <MetaRow label="배포 방식" value={familyMeta.deployProvider} />
        </dl>
      </section>
    </div>
  );
}
