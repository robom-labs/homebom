// 접수 시점을 한눈에 보여주는 청약봄의 주간 캘린더 요약이다.
import type { Notice } from "@zoopzoopcall/core";

type Props = {
  notices: Notice[];
  now: number;
};

const DAY = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
const DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_NUMBER = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", day: "numeric" });

function dateKey(value: number | string): string {
  return DATE.format(typeof value === "number" ? new Date(value) : new Date(value));
}

export function NoticeCalendar({ notices, now }: Props) {
  const days = Array.from({ length: 7 }, (_, index) => new Date(now + index * 86_400_000));

  return (
    <section className="notice-calendar" aria-labelledby="calendar-title">
      <div className="notice-calendar__head">
        <div><p>이번 주 접수</p><h2 id="calendar-title">날짜부터 먼저 살펴보세요.</h2></div>
        <span>7일 보기</span>
      </div>
      <div className="notice-calendar__days" role="list" aria-label="이번 주 청약 접수 일정">
        {days.map((date) => {
          const key = dateKey(date.getTime());
          const starts = notices.filter((notice) => dateKey(notice.receiptStart) === key).length;
          const ends = notices.filter((notice) => dateKey(notice.receiptEnd) === key).length;
          const today = key === dateKey(now);
          return <div className={`notice-calendar__day${today ? " is-today" : ""}`} role="listitem" key={key}>
            <small>{DAY.format(date)}</small><strong>{DAY_NUMBER.format(date)}</strong>
            <span>{starts ? `접수 ${starts}` : ends ? `마감 ${ends}` : "·"}</span>
          </div>;
        })}
      </div>
    </section>
  );
}
