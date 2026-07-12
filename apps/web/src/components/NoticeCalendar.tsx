// 이번 달 접수 일정을 모바일에서는 접어서, 데스크톱에서는 펼쳐 보여주는 청약봄 월(月) 캘린더다.
import { useEffect, useState } from "react";
import type { Notice } from "@zoopzoopcall/core";
import { buildMonthGrid, WEEKDAYS } from "./noticeCalendar.model";

// calendarDateKey는 ListScreen 날짜 필터가 함께 쓰므로 여기서 재수출한다.
export { calendarDateKey } from "./noticeCalendar.model";

type Props = {
  notices: Notice[];
  now: number;
  selectedKey?: string | null;
  onSelectDay?: (key: string | null) => void;
};

export function NoticeCalendar({ notices, now, selectedKey, onSelectDay }: Props) {
  const grid = buildMonthGrid(now, notices);
  const [expanded, setExpanded] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 600,
  );
  const starts = grid.cells.reduce((sum, cell) => sum + cell.starts, 0);
  const ends = grid.cells.reduce((sum, cell) => sum + cell.ends, 0);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 600px)");
    const expandForDesktop = () => {
      if (desktop.matches) setExpanded(true);
    };
    desktop.addEventListener("change", expandForDesktop);
    return () => desktop.removeEventListener("change", expandForDesktop);
  }, []);

  return (
    <section className={`notice-calendar${expanded ? " is-open" : ""}`} aria-labelledby="calendar-title">
      <button
        type="button"
        className="notice-calendar__summary"
        aria-expanded={expanded}
        aria-controls="notice-calendar-grid"
        onClick={() => setExpanded((value) => !value)}
      >
        <span>
          <strong>이번 달 일정</strong>
          <small>{grid.label} · 접수 {starts}건 · 마감 {ends}건</small>
        </span>
        <span className="notice-calendar__summary-action">{expanded ? "접기" : "보기"}</span>
      </button>
      <div className="notice-calendar__body" hidden={!expanded}>
        <div className="notice-calendar__head">
          <div>
            <p>이번 달 접수</p>
            <h2 id="calendar-title">{grid.label}</h2>
          </div>
          <span className="notice-calendar__legend">
            <i className="notice-calendar__dot notice-calendar__dot--start" />접수
            <i className="notice-calendar__dot notice-calendar__dot--end" />마감
          </span>
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
            const count = cell.starts + cell.ends;
            const selected = selectedKey === cell.key;
            const detail = [
              cell.starts ? `접수 ${cell.starts}건` : "",
              cell.ends ? `마감 ${cell.ends}건` : "",
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
                  {cell.starts > 0 && <i className="notice-calendar__dot notice-calendar__dot--start" />}
                  {cell.ends > 0 && <i className="notice-calendar__dot notice-calendar__dot--end" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
