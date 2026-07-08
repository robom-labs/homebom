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
          무순위·잔여세대·취소후재공급 청약 접수 시작과 마감 시간을 챙기기 위한 알림 서비스입니다.
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
          <li>줍줍콜은 당첨 가능성이나 자격을 판정하지 않습니다.</li>
          <li>현재 알림은 앱이 실행 중일 때 동작합니다. 중요한 일정은 청약홈에서도 함께 확인하세요.</li>
        </ul>
      </section>

      <p className="fineprint">
        줍줍콜 ·{" "}
        <a href="https://github.com/runnerpyrri-lgtm/zoopzoopcall" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </p>
    </div>
  );
}
