// 이번 달 접수 일정을 모바일에서는 접어서, 데스크톱에서는 펼쳐 보여주는 청약봄 월(月) 캘린더다.
import { useEffect, useState } from "react";
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
  const [viewMonth, setViewMonth] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const grid = buildMonthGrid(now, notices, viewMonth.year, viewMonth.month);
  const [expanded, setExpanded] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 600,
  );
  const winners = grid.cells.reduce((sum, cell) => sum + cell.winners, 0);
  const moveMonth = (delta: number) => {
    setViewMonth((current) => {
      const date = new Date(Date.UTC(current.year, current.month - 1 + delta, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    });
    onSelectDay?.(null);
  };

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
          <small>{grid.label} · 공고 {grid.noticeCount}건 · 발표 {winners}건</small>
        </span>
          <span className="notice-calendar__summary-action">{expanded ? "접기" : "달력 보기"}</span>
      </button>
      <div className="notice-calendar__body" hidden={!expanded}>
        <div className="notice-calendar__head">
          <button type="button" className="notice-calendar__move" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
          <div className="notice-calendar__month-title">
            <p>이번 달 접수</p>
            <h2 id="calendar-title">{grid.label}</h2>
          </div>
          <span className="notice-calendar__legend">
            <i className="notice-calendar__dot notice-calendar__dot--start" />접수
            <i className="notice-calendar__dot notice-calendar__dot--end" />마감
            <i className="notice-calendar__dot notice-calendar__dot--winner" />발표
          </span>
          <button type="button" className="notice-calendar__move" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
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
            const count = cell.starts + cell.ends + cell.winners + cell.contracts;
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
                  {cell.starts > 0 && <i className="notice-calendar__dot notice-calendar__dot--start" />}
                  {cell.ends > 0 && <i className="notice-calendar__dot notice-calendar__dot--end" />}
                  {cell.winners > 0 && <i className="notice-calendar__dot notice-calendar__dot--winner" />}
                  {cell.contracts > 0 && <i className="notice-calendar__dot notice-calendar__dot--contract" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
