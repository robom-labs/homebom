// 공고 목록 화면. 유형·지역 필터 + 접수중/예정/마감·취소 상태를 골라 본다.
import { useEffect, useMemo, useState } from "react";
import type { Notice } from "@zoopzoopcall/core";
import { getNoticeStatus } from "@zoopzoopcall/core";
import { AppHeader } from "../components/AppHeader";
import { FilterBar, type StatusView, type TypeFilter } from "../components/FilterBar";
import { NoticeCard } from "../components/NoticeCard";
import { NoticeCalendar } from "../components/NoticeCalendar";
import { PermissionBanner } from "../components/PermissionBanner";
import { useNow } from "../hooks/useNow";
import type { NoticeSource } from "../hooks/useNotices";
import type { SubMap } from "../store/subscriptions";

type Props = {
  notices: Notice[];
  source: NoticeSource;
  error: string | null;
  loading: boolean;
  subs: SubMap;
};

const STATUS_ORDER: StatusView[] = ["접수중", "접수예정", "마감·취소"];
const HEADING: Record<StatusView, string> = {
  접수중: "지금 접수중",
  접수예정: "접수 예정",
  "마감·취소": "마감·취소",
};

export function ListScreen({ notices, source, error, loading, subs }: Props) {
  const now = useNow(15_000);
  const [type, setType] = useState<TypeFilter>("전체");
  const [region, setRegion] = useState("전체");
  const [statusView, setStatusView] = useState<StatusView>("접수중");
  const [touched, setTouched] = useState(false);

  const regions = useMemo(
    () => [...new Set(notices.map((n) => n.region))].sort((a, b) => a.localeCompare(b, "ko")),
    [notices],
  );

  const filtered = useMemo(
    () =>
      notices.filter((n) => {
        if (type !== "전체" && n.type !== type) return false;
        if (region !== "전체" && n.region !== region) return false;
        return true;
      }),
    [notices, type, region],
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

  const onStatusView = (s: StatusView) => {
    setTouched(true);
    setStatusView(s);
  };

  const active = groups[statusView];

  return (
    <div className="screen">
      <AppHeader source={source} />

      {error && <div className="notice-bar">{error}</div>}

      <PermissionBanner compact hidePrompt />

      {notices.length > 0 && (
        <FilterBar
          activeType={type}
          onType={setType}
          regions={regions}
          region={region}
          onRegion={setRegion}
          statusView={statusView}
          onStatusView={onStatusView}
          counts={counts}
        />
      )}

      {!loading && <NoticeCalendar notices={filtered} now={now} />}

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

      {!loading && filtered.length === 0 && source === "live" && (
        <div className="empty">
          <p className="empty__title">조건에 맞는 공고가 없어요</p>
          <p className="empty__body">
            새 청약 공고가 확인되면 여기에 표시됩니다. 이미 켜둔 알림은 저장된 공고 기준으로 유지됩니다.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
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
