// 공고 목록 화면. 유형·지역 필터 + 접수중/예정/마감·취소 상태를 골라 본다.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ApplicationEvent, Notice } from "@zoopzoopcall/core";
import { formatKstDateTime, getNoticeStatus, kstMonthWindowEnd } from "@zoopzoopcall/core";
import { AppHeader } from "../components/AppHeader";
import { FilterBar, type StatusView, type TypeFilter } from "../components/FilterBar";
import { NoticeCard } from "../components/NoticeCard";
import { NoticeCalendar } from "../components/NoticeCalendar";
import { PermissionBanner } from "../components/PermissionBanner";
import { compareScheduleEvents, eventsOnDate, noticeMatchesEventFilter, type EventFilter } from "../components/noticeSchedule";
import { noticeSchedule } from "../components/noticeSchedule";
import { useNow } from "../hooks/useNow";
import type { NoticeSource } from "../hooks/useNotices";
import type { SubMap } from "../store/subscriptions";

type Props = {
  notices: Notice[];
  source: NoticeSource;
  error: string | null;
  loading: boolean;
  verifiedAt: string | null;
  subs: SubMap;
};

const STATUS_ORDER: StatusView[] = ["접수중", "접수예정", "마감·취소"];
const HEADING: Record<StatusView, string> = {
  접수중: "지금 접수 중",
  접수예정: "접수 예정",
  "마감·취소": "마감·취소",
};

export function ListScreen({ notices, source, error, loading, verifiedAt, subs }: Props) {
  const now = useNow(15_000);
  const [type, setType] = useState<TypeFilter>("전체");
  const [region, setRegion] = useState("전체");
  const [statusView, setStatusView] = useState<StatusView>("접수중");
  const [touched, setTouched] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>("전체");
  // 캘린더에서 고른 날짜(KST YYYY-MM-DD). 선택 시 그날 접수·발표·계약 공고만 리스트로 보여준다.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const agendaRef = useRef<HTMLHeadingElement>(null);

  const visibleNotices = useMemo(() => {
    const nextMonthEnd = kstMonthWindowEnd(now);
    return notices.filter((notice) => {
      if (getNoticeStatus(notice, now) === "접수중") return true;
      return noticeSchedule(notice).some((event) => Date.parse(event.start) <= nextMonthEnd && Date.parse(event.end ?? event.start) >= now);
    });
  }, [notices, now]);

  const regions = useMemo(
    () => [...new Set(visibleNotices.map((n) => n.region))].sort((a, b) => a.localeCompare(b, "ko")),
    [visibleNotices],
  );

  const filtered = useMemo(
    () =>
      visibleNotices.filter((n) => {
        if (type !== "전체" && n.type !== type && !(type === "취소후재공급" && n.type === "불법행위 재공급")) return false;
        if (region !== "전체" && n.region !== region) return false;
        if (!noticeMatchesEventFilter(n, eventFilter)) return false;
        return true;
      }),
    [visibleNotices, type, region, eventFilter],
  );

  const groups = useMemo(() => {
    const 접수중 = filtered
      .filter((n) => getNoticeStatus(n, now) === "접수중")
      .sort((a, b) => Date.parse(a.receiptEnd) - Date.parse(b.receiptEnd));
    const 접수예정 = filtered
      .filter((n) => ["예정", "정정"].includes(getNoticeStatus(n, now)))
      .sort((a, b) => Date.parse(a.receiptStart) - Date.parse(b.receiptStart));
    const 마감취소 = filtered
      .filter((n) => ["마감", "취소"].includes(getNoticeStatus(n, now)))
      .sort((a, b) => Date.parse(b.receiptEnd) - Date.parse(a.receiptEnd));
    return { 접수중, 접수예정, "마감·취소": 마감취소 } as Record<StatusView, Notice[]>;
  }, [filtered, now]);

  const counts = useMemo(
    () => ({
      접수중: groups["접수중"].length,
      접수예정: groups["접수예정"].length,
      "마감·취소": groups["마감·취소"].length,
    }),
    [groups],
  );

  // 사용자가 아직 상태를 고르지 않았으면, 공고가 있는 첫 상태를 자동 선택한다.
  useEffect(() => {
    if (touched) return;
    const firstNonEmpty = STATUS_ORDER.find((s) => counts[s] > 0);
    if (firstNonEmpty && firstNonEmpty !== statusView) setStatusView(firstNonEmpty);
  }, [counts, touched, statusView]);

  // 유형·지역·상태를 바꾸면 날짜 선택은 해제해 필터가 서로 충돌하지 않게 한다.
  const onType = (t: TypeFilter) => { setSelectedDay(null); setType(t); };
  const onRegion = (r: string) => { setSelectedDay(null); setRegion(r); };
  const onStatusView = (s: StatusView) => {
    setSelectedDay(null);
    setTouched(true);
    setStatusView(s);
  };

  const active = groups[statusView];

  // 선택한 날짜의 일정을 공고가 아니라 event 한 행 단위로 만든다.
  const dayAgenda = useMemo(() => {
    if (!selectedDay) return [];
    return filtered.flatMap((notice) => eventsOnDate(notice, selectedDay).map((event) => ({ notice, event })))
      .sort((a, b) => compareScheduleEvents(a.event, b.event, a.notice, b.notice));
  }, [filtered, selectedDay]);

  useEffect(() => {
    if (!selectedDay) return;
    window.requestAnimationFrame(() => {
      agendaRef.current?.focus({ preventScroll: true });
      agendaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [selectedDay]);

  const dayLabel = selectedDay
    ? `${Number(selectedDay.slice(5, 7))}월 ${Number(selectedDay.slice(8, 10))}일`
    : "";

  return (
    <div className="screen">
      <AppHeader source={source} />

      {/* stale이면 아래 전용 배너가 같은 내용을 안내하므로 generic 오류 바를 겹쳐 띄우지 않는다. */}
      {error && source !== "stale" && <div className="notice-bar">{error}</div>}
      {source === "stale" && (
        <div className="notice-bar notice-bar--stale" role="status">
          공식 공고 연결이 잠시 지연돼 마지막 확인본을 보여드려요.
          {verifiedAt ? ` 마지막 확인 ${new Date(verifiedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}.` : ""}
          {" "}신청 전 청약홈 원문을 다시 확인해 주세요.
        </div>
      )}

      <PermissionBanner compact hidePrompt />

      {!loading && (
        <NoticeCalendar
          notices={filtered}
          now={now}
          selectedKey={selectedDay}
          onSelectDay={setSelectedDay}
        />
      )}

      {!loading && filtered.length > 0 && selectedDay && (
        <section className="day-agenda" aria-labelledby="selected-agenda-title" aria-live="polite">
          <div className="section-heading">
            <h2 id="selected-agenda-title" ref={agendaRef} tabIndex={-1}>{dayLabel} 일정 <span>{dayAgenda.length}</span></h2>
            <button type="button" className="day-clear" onClick={() => setSelectedDay(null)}>전체 일정으로</button>
          </div>
          {dayAgenda.length > 0 ? dayAgenda.map(({ notice, event }: { notice: Notice; event: ApplicationEvent }) => (
            <div className="day-agenda__item" key={`${notice.id}-${event.id ?? `${event.kind}-${event.start}`}`}>
              <span>{event.label}</span>
              <strong>{notice.houseName}</strong>
              <small>{notice.region} · {notice.supplyCount != null ? `${notice.supplyCount.toLocaleString("ko-KR")}세대` : "모집 세대 공고문 확인"}</small>
              <time dateTime={event.start}>{formatKstDateTime(event.start)}{event.end && event.end !== event.start ? ` ~ ${formatKstDateTime(event.end)}` : ""}</time>
              <div className="day-agenda__actions">
                {/* HashRouter 앱이므로 path 하드코딩(/homebom/…)은 풀 페이지 이동 → GitHub Pages 404가 된다. */}
                <Link to={`/notice/${encodeURIComponent(notice.id)}`}>상세</Link>
                <Link to={`/notice/${encodeURIComponent(notice.id)}#alerts`}>{notice.id in subs ? "알림 설정됨" : "이 일정 알림"}</Link>
              </div>
            </div>
          )) : <p className="section-empty">선택한 날의 일정이 없어요.</p>}
        </section>
      )}

      {notices.length > 0 && (
        <FilterBar
          activeType={type}
          onType={onType}
          regions={regions}
          region={region}
          onRegion={onRegion}
          statusView={statusView}
          onStatusView={onStatusView}
          counts={counts}
          eventFilter={eventFilter}
          onEventFilter={(value) => { setSelectedDay(null); setEventFilter(value); }}
        />
      )}

      {loading && <p className="empty">공고를 불러오는 중입니다…</p>}

      {!loading && filtered.length === 0 && source === "not-connected" && (
        <div className="empty">
          <p className="empty__title">실공고 연결 대기 중입니다</p>
          <p className="empty__body">
            청약 공고는 9시에만 보이는 방식이 아닙니다. 데이터 연결이 완료되기 전까지 임의 단지나 추정
            공고는 보여주지 않습니다.
          </p>
        </div>
      )}

      {!loading && filtered.length === 0 && (source === "live" || source === "stale") && (
        <div className="empty">
          <p className="empty__title">조건에 맞는 공고가 없어요</p>
          <p className="empty__body">
            새 청약 공고가 확인되면 여기에 표시됩니다. 이미 켜둔 알림은 저장된 공고 기준으로 유지됩니다.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && !selectedDay && (
        <>
          <section className="opportunities" aria-labelledby="notice-list-title">
            <div className="section-heading"><h2 id="notice-list-title">{statusView === "접수예정" ? "곧 열리는 기회" : HEADING[statusView]}</h2><span>{active.length}</span></div>
            {active.length > 0 ? active.map((n) => <NoticeCard key={n.id} notice={n} now={now} subscribed={n.id in subs} />) : <p className="section-empty">이 상태의 공고가 지금은 없어요.</p>}
          </section>

          <aside className="ad-slot" aria-label="비활성 광고 영역">
            <span>광고</span>
            <p>추천 금융·주거 정보</p>
            <strong>준비 중</strong>
          </aside>
        </>
      )}
    </div>
  );
}
