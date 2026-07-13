// 이번 달 접수 일정을 모바일에서는 접어서, 데스크톱에서는 펼쳐 보여주는 청약봄 월(月) 캘린더다.
import { useState } from "react";
import type { Notice } from "@zoopzoopcall/core";
import { buildMonthGrid, calendarDateKey, WEEKDAYS } from "./noticeCalendar.model";

// calendarDateKey는 ListScreen 날짜 필터가 함께 쓰므로 여기서 재수출한다.
export { calendarDateKey } from "./noticeCalendar.model";

type Props = {
  notices: Notice[];
  now: number;
  selectedKey?: string | null;
  onSelectDay?: (key: string | null) => void;
};

export function NoticeCalendar({ notices, now, selectedKey, onSelectDay }: Props) {
  const today = calendarDateKey(now);
  const currentMonth = {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  };
  const [monthOffset, setMonthOffset] = useState(0);
  const viewDate = new Date(Date.UTC(currentMonth.year, currentMonth.month - 1 + monthOffset, 1));
  const viewMonth = { year: viewDate.getUTCFullYear(), month: viewDate.getUTCMonth() + 1 };
  const grid = buildMonthGrid(now, notices, viewMonth.year, viewMonth.month);
  const changeMonth = (offset: number) => {
    setMonthOffset(offset);
    onSelectDay?.(null);
  };

  return (
    <section className="notice-calendar is-open" aria-labelledby="calendar-title">
      <div className="notice-calendar__body">
        <div className="notice-calendar__head">
          <div className="notice-calendar__month-title">
            <p>청약 일정</p>
            <h2 id="calendar-title">{grid.label}</h2>
          </div>
          <div className="notice-calendar__month-tabs" role="tablist" aria-label="달 선택">
            <button role="tab" aria-selected={monthOffset === 0} onClick={() => changeMonth(0)}>이번 달</button>
            <button role="tab" aria-selected={monthOffset === 1} onClick={() => changeMonth(1)}>다음 달</button>
          </div>
        </div>
        <div className="notice-calendar__dow" aria-hidden="true">
          {WEEKDAYS.map((label, index) => (
            <span
              key={label}
              className={`notice-calendar__dow-cell${index === 0 ? " is-sun" : index === 6 ? " is-sat" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>
        <div id="notice-calendar-grid" className="notice-calendar__grid" role="group" aria-label={`${grid.label} 청약 접수 일정`}>
          {grid.cells.map((cell, index) => {
            if (!cell.inMonth) {
              return <span className="notice-calendar__blank" key={`blank-${index}`} aria-hidden="true" />;
            }
            const count = cell.markers.length;
            const selected = selectedKey === cell.key;
            const detail = [
              cell.starts ? `접수 ${cell.starts}건` : "",
              cell.ends ? `마감 ${cell.ends}건` : "",
              cell.winners ? `발표 ${cell.winners}건` : "",
              cell.contracts ? `계약 ${cell.contracts}건` : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                type="button"
                key={cell.key}
                className={`notice-calendar__day${cell.today ? " is-today" : ""}${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                aria-label={`${cell.day}일 ${detail || "일정 없음"}`}
                disabled={count === 0}
                onClick={() => onSelectDay?.(selected ? null : cell.key)}
              >
                <strong>{cell.day}</strong>
                <span className="notice-calendar__marks" aria-hidden="true">
                  {cell.markers.slice(0, 2).map((marker) => (
                    <i key={`${marker.kind}-${marker.label}`} className={`notice-calendar__marker notice-calendar__marker--${marker.kind}`}>{marker.label}</i>
                  ))}
                  {cell.markers.length > 2 && <i className="notice-calendar__more">+{cell.markers.length - 2}</i>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
