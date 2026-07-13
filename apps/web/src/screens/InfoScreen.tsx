// 설정과 앱 정보를 한곳에서 제공하며 기존 안내 경로와 호환한다.
import type { NoticeSource } from "../hooks/useNotices";
import packageInfo from "../../package.json";
import { AppHeader } from "../components/AppHeader";

const APP_VERSION = packageInfo.version;
const CONTACT = "hello.robom@gmail.com";
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || "local";
const PWA_CACHE = "zzc-v12";

function mailto(purpose: string): string {
  const subject = `[청약봄] ${purpose} 문의 · v${APP_VERSION}`;
  return `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}`;
}

export function InfoScreen({ source }: { source: NoticeSource }) {
  return (
    <div className="screen">
      <AppHeader title="설정" compact />

      <section className="settings-section" aria-labelledby="family-apps">
        <h2 id="family-apps">다른 로봄 앱</h2>
        <a className="settings-row" href="https://robom.kr/apps/outbom" target="_blank" rel="noreferrer">
          <span><strong>야외봄</strong><small>바깥바람이 좋은 때</small></span>
          <em>웹으로 이용</em>
        </a>
        <a className="settings-row" href="https://robom.kr/apps/runningbom" target="_blank" rel="noreferrer">
          <span><strong>러닝봄</strong><small>출발선에 서는 날</small></span>
          <em>웹으로 이용</em>
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

      <section className="info-card">
        <h2>홈 화면에 추가하면 앱처럼 쓸 수 있어요</h2>
        <p>
          <strong>안드로이드(크롬)</strong> — 메뉴(⋮) → 홈 화면에 추가.
        </p>
        <p>
          <strong>아이폰(사파리)</strong> — 공유(□↑) → 홈 화면에 추가. 아이폰은 홈 화면에 추가한
          아이콘으로 열어야 알림을 받을 수 있어요.
        </p>
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
      </section>

      <section className="info-card">
        <h2>알아두세요</h2>
        <ul>
          <li>청약홈 신청 가능 시간은 영업일 09:00~17:30 기준입니다.</li>
          <li>접수 일정은 정정 공고로 바뀔 수 있어요. 신청 전 모집공고 원문을 확인하세요.</li>
          <li>청약봄은 당첨 가능성이나 자격을 판정하지 않습니다.</li>
          <li>현재 알림은 앱이 실행 중일 때 동작합니다. 중요한 일정은 청약홈에서도 함께 확인하세요.</li>
        </ul>
      </section>

      <section className="settings-section" aria-labelledby="legal-settings">
        <h2 id="legal-settings">서비스 정보</h2>
        <a className="settings-row" href="https://robom.kr/privacy/homebom" target="_blank" rel="noreferrer">
          <span><strong>개인정보처리방침</strong></span><b aria-hidden="true">›</b>
        </a>
        <a className="settings-row" href="https://robom.kr/terms" target="_blank" rel="noreferrer">
          <span><strong>이용약관</strong></span><b aria-hidden="true">›</b>
        </a>
        <a className="settings-row" href="https://github.com/robom-labs/homebom" target="_blank" rel="noreferrer">
          <span><strong>오픈소스 라이선스</strong><small>사용한 소프트웨어와 소스 보기</small></span><b aria-hidden="true">›</b>
        </a>
        <a className="settings-row" href="https://robom.kr" target="_blank" rel="noreferrer">
          <span><strong>robom.kr</strong><small>로봄 패밀리 공식 사이트</small></span><b aria-hidden="true">›</b>
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
