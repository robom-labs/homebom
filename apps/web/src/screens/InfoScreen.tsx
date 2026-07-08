// 안내 화면. 서비스 소개·데이터 출처·홈 화면 추가 방법·실데이터 연결 안내.
import type { NoticeSource } from "../hooks/useNotices";

export function InfoScreen({ source }: { source: NoticeSource }) {
  return (
    <div className="screen">
      <header className="masthead">
        <h1 className="masthead__brand masthead__brand--sub">안내</h1>
      </header>

      <section className="info-card">
        <h2>줍줍콜은</h2>
        <p>
          무순위·잔여세대·취소후재공급 청약(이른바 줍줍) 접수가 열리고 닫히는 순간을, 내 조건에 맞는
          것만 골라 폰으로 미리 울려주는 서비스입니다.
        </p>
        <p>
          줍줍콜은 정보를 모아 알려드릴 뿐, 청약 신청과 자격 확인은 언제나{" "}
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
          {source === "sample" && (
            <>
              {" "}
              지금 보이는 공고는 <strong>화면·알림 동작 확인용 샘플</strong>이며 실제 공고가 아닙니다.
              서비스키와 프록시 함수를 연결하면 실제 공고로 전환됩니다(저장소의 DEPLOY 문서 참고).
            </>
          )}
        </p>
      </section>

      <section className="info-card">
        <h2>알아두세요</h2>
        <ul>
          <li>접수 일정은 정정 공고로 바뀔 수 있어요. 신청 전 청약홈 원문을 확인하세요.</li>
          <li>줍줍콜은 당첨 가능성이나 자격을 판정하지 않습니다.</li>
          <li>v0.1.0 알림은 앱(브라우저)이 실행 중일 때 울립니다. 서버 푸시는 v0.2.0 예정.</li>
        </ul>
      </section>

      <p className="fineprint">
        줍줍콜 v0.1.0 ·{" "}
        <a href="https://github.com/runnerpyrri-lgtm/zoopzoopcall" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </p>
    </div>
  );
}
