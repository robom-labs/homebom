// 설정과 앱 정보를 한곳에서 제공하며 기존 안내 경로와 호환한다.
// 로봄 패밀리 공통 설정 흐름: 브랜드 헤더+구분선 아래 바로 시작 —
// 앱 소개 → 알림 권한(폰 설정·배터리 예외 딥링크) → 다른 로봄 앱 → 문의 → 데이터 출처 → 정책과 정보 → 앱 정보.
import { useState } from "react";
import type { NoticeSource } from "../hooks/useNotices";
import packageInfo from "../../package.json";
import { AppHeader } from "../components/AppHeader";
import { notificationSupport, requestPermission } from "../notify/notifications";

const APP_VERSION = packageInfo.version;
const CONTACT = "hello.robom@gmail.com";
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || "local";
const PWA_CACHE = "zzc-v16";

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

export function InfoScreen({ source }: { source: NoticeSource }) {
  const [permission, setPermission] = useState<string>(() =>
    notificationSupport() ? Notification.permission : "unsupported",
  );
  const [guide, setGuide] = useState<string | null>(null);

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

      <section className="info-card" aria-labelledby="about-homebom">
        <h2 id="about-homebom">청약봄은</h2>
        <p>
          일반공급·특별공급·순위별 접수와 무순위·잔여세대·불법행위 재공급 일정을 함께 챙기는 알림 서비스입니다.
        </p>
        <p>
          청약 신청과 자격 확인은 언제나{" "}
          <a href="https://www.applyhome.co.kr" target="_blank" rel="noreferrer">
            청약홈(applyhome.co.kr)
          </a>
          에서 직접 진행하셔야 합니다.
        </p>
      </section>

      <section className="info-card" aria-labelledby="notify-env">
        <h2 id="notify-env">알림 권한</h2>
        <p>{permissionLabel}</p>
        <p>
          현재 알림은 앱이 실행 중일 때 동작합니다. 아이폰은 홈 화면에 추가한 아이콘(사파리 공유 → 홈
          화면에 추가)으로 열어야 알림을 받을 수 있어요.
        </p>
        <div className="settings-actions">
          {permission !== "granted" && permission !== "unsupported" && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => void requestPermission().then((p) => setPermission(p))}
            >
              알림 켜기
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
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
            className="btn btn--ghost btn--sm"
            onClick={() =>
              openAndroidSetting("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS", () =>
                setGuide("폰 설정 → 배터리 → 배터리 최적화(앱 절전)에서 사용 중인 브라우저를 예외로 지정하면 알림 지연이 줄어요."),
              )
            }
          >
            배터리 예외 설정 열기
          </button>
        </div>
        {guide && <p className="settings-guide" role="status">{guide}</p>}
      </section>

      <section className="settings-section" aria-labelledby="family-apps">
        <h2 id="family-apps">다른 로봄 앱</h2>
        <a className="settings-row" href="https://robom.kr/apps/outbom" target="_blank" rel="noreferrer">
          <span><strong>야외봄</strong><small>날씨·대기질로 나가기 좋은 시간 알림</small></span>
          <em>웹으로 이용</em>
        </a>
        <a className="settings-row" href="https://robom.kr/apps/runningbom" target="_blank" rel="noreferrer">
          <span><strong>러닝봄</strong><small>러닝 대회 접수 시작·마감 알림</small></span>
          <em>웹으로 이용</em>
        </a>
        <a className="settings-row" href="https://robom.kr" target="_blank" rel="noreferrer">
          <span><strong>robom.kr</strong><small>로봄 패밀리 공식 사이트</small></span>
          <em>바로가기</em>
        </a>
      </section>

      <section className="settings-section" aria-labelledby="contact-settings">
        <h2 id="contact-settings">문의</h2>
        <a className="settings-row" href={mailto("일반")}>
          <span><strong>일반 문의</strong><small>{CONTACT}</small></span><b aria-hidden="true">›</b>
        </a>
        <a className="settings-row" href={mailto("광고·제휴")}>
          <span><strong>광고·제휴 문의</strong><small>{CONTACT}</small></span><b aria-hidden="true">›</b>
        </a>
      </section>

      <section className="info-card">
        <h2>데이터 출처</h2>
        <p>
          공공데이터포털의 <strong>한국부동산원 청약홈 분양정보 조회 서비스</strong>를 사용합니다.
          {source === "not-connected" && (
            <>
              {" "}
              실공고 연결이 완료되지 않은 상태에서는 임의 공고를 표시하지 않습니다.
            </>
          )}
        </p>
        <ul>
          <li>청약홈 신청 가능 시간은 영업일 09:00~17:30 기준입니다.</li>
          <li>접수 일정은 정정 공고로 바뀔 수 있어요. 신청 전 모집공고 원문을 확인하세요.</li>
          <li>청약봄은 당첨 가능성이나 자격을 판정하지 않습니다.</li>
        </ul>
      </section>

      <section className="settings-section" aria-labelledby="legal-settings">
        <h2 id="legal-settings">정책과 정보</h2>
        <a className="settings-row" href="https://robom.kr/privacy/homebom" target="_blank" rel="noreferrer">
          <span><strong>개인정보처리방침</strong></span><b aria-hidden="true">›</b>
        </a>
        <a className="settings-row" href="https://robom.kr/terms" target="_blank" rel="noreferrer">
          <span><strong>이용약관</strong></span><b aria-hidden="true">›</b>
        </a>
        <a className="settings-row" href="https://github.com/robom-labs/homebom" target="_blank" rel="noreferrer">
          <span><strong>오픈소스 라이선스</strong><small>사용한 소프트웨어와 소스 보기</small></span><b aria-hidden="true">›</b>
        </a>
      </section>

      <footer className="app-meta">
        <strong>개발자 · 로봄</strong>
        <span>청약봄 v{APP_VERSION}</span>
        <span>빌드 {BUILD_SHA.slice(0, 7)} · PWA {PWA_CACHE}</span>
        <span>공고 데이터 · 한국부동산원 청약홈</span>
      </footer>
    </div>
  );
}
