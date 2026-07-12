// 접수 시점을 한눈에 보여주는 청약봄의 주간 캘린더 요약이다.
import type { Notice } from "@zoopzoopcall/core";

type Props = {
  notices: Notice[];
  now: number;
  selectedKey?: string | null;
  onSelectDay?: (key: string | null) => void;
};

const DAY = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
const DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_NUMBER = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", day: "numeric" });

// 캘린더 날짜 키(KST YYYY-MM-DD). 이 규칙은 ListScreen의 날짜 필터와 동일해야 한다.
export function calendarDateKey(value: number | string): string {
  return DATE.format(typeof value === "number" ? new Date(value) : new Date(value));
}

export function NoticeCalendar({ notices, now, selectedKey, onSelectDay }: Props) {
  const days = Array.from({ length: 7 }, (_, index) => new Date(now + index * 86_400_000));

  return (
    <section className="notice-calendar" aria-labelledby="calendar-title">
      <div className="notice-calendar__head">
        <div><p>이번 주 접수</p><h2 id="calendar-title">날짜를 눌러 그날 공고를 봐요.</h2></div>
        <span>7일 보기</span>
      </div>
      <div className="notice-calendar__days" role="group" aria-label="이번 주 청약 접수 일정">
        {days.map((date) => {
          const key = calendarDateKey(date.getTime());
          const starts = notices.filter((notice) => calendarDateKey(notice.receiptStart) === key).length;
          const ends = notices.filter((notice) => calendarDateKey(notice.receiptEnd) === key).length;
          const today = key === calendarDateKey(now);
          const count = starts || ends;
          const selected = selectedKey === key;
          return (
            <button
              type="button"
              className={`notice-calendar__day${today ? " is-today" : ""}${selected ? " is-selected" : ""}`}
              key={key}
              aria-pressed={selected}
              aria-label={`${DAY_NUMBER.format(date)}일 ${starts ? `접수 ${starts}건` : ends ? `마감 ${ends}건` : "일정 없음"}`}
              disabled={count === 0}
              onClick={() => onSelectDay?.(selected ? null : key)}
            >
              <small>{DAY.format(date)}</small><strong>{DAY_NUMBER.format(date)}</strong>
              <span>{starts ? `접수 ${starts}` : ends ? `마감 ${ends}` : "·"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
