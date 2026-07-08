// 공고 목록 화면. 필터 + 접수중/예정/마감 그룹으로 보여준다.
import { useMemo, useState } from "react";
import type { Notice } from "@zoopzoopcall/core";
import { getNoticeStatus } from "@zoopzoopcall/core";
import { FilterBar, type TypeFilter } from "../components/FilterBar";
import { NoticeCard } from "../components/NoticeCard";
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

export function ListScreen({ notices, source, error, loading, subs }: Props) {
  const now = useNow(15_000);
  const [type, setType] = useState<TypeFilter>("전체");
  const [region, setRegion] = useState("전체");
  const [openOnly, setOpenOnly] = useState(false);

  const regions = useMemo(
    () => [...new Set(notices.map((n) => n.region))].sort((a, b) => a.localeCompare(b, "ko")),
    [notices],
  );

  const filtered = useMemo(
    () =>
      notices.filter((n) => {
        if (type !== "전체" && n.type !== type) return false;
        if (region !== "전체" && n.region !== region) return false;
        if (openOnly && getNoticeStatus(n, now) !== "접수중") return false;
        return true;
      }),
    [notices, type, region, openOnly, now],
  );

  const groups = useMemo(() => {
    const open = filtered
      .filter((n) => getNoticeStatus(n, now) === "접수중")
      .sort((a, b) => Date.parse(a.receiptEnd) - Date.parse(b.receiptEnd));
    const upcoming = filtered
      .filter((n) => ["예정", "정정"].includes(getNoticeStatus(n, now)))
      .sort((a, b) => Date.parse(a.receiptStart) - Date.parse(b.receiptStart));
    const finished = filtered
      .filter((n) => ["마감", "취소"].includes(getNoticeStatus(n, now)))
      .sort((a, b) => Date.parse(b.receiptEnd) - Date.parse(a.receiptEnd));
    return { open, upcoming, finished };
  }, [filtered, now]);

  return (
    <div className="screen">
      <header className="masthead">
        <div className="masthead__row">
          <h1 className="masthead__brand">줍줍콜</h1>
          <span className={`source source--${source}`}>
            {source === "live" ? "실공고" : "연결 필요"}
          </span>
        </div>
        <p className="masthead__tagline">청약홈 접수 시작과 마감 시간을 놓치지 않게 챙깁니다.</p>
      </header>

      {error && <div className="notice-bar">{error}</div>}

      <PermissionBanner compact />

      {notices.length > 0 && (
        <FilterBar
          activeType={type}
          onType={setType}
          regions={regions}
          region={region}
          onRegion={setRegion}
          openOnly={openOnly}
          onOpenOnly={setOpenOnly}
        />
      )}

      {loading && <p className="empty">공고를 불러오는 중입니다…</p>}

      {!loading && filtered.length === 0 && source === "not-connected" && (
        <div className="empty">
          <p className="empty__title">실공고 연결 대기 중입니다</p>
          <p className="empty__body">
            지금 화면에는 실제 청약 공고만 표시합니다. 데이터 연결이 완료되기 전까지 임의 단지나
            추정 공고는 보여주지 않습니다.
          </p>
        </div>
      )}

      {!loading && filtered.length === 0 && source === "live" && (
        <div className="empty">
          <p className="empty__title">조건에 맞는 공고가 없어요</p>
          <p className="empty__body">필터를 넓혀보세요. 새 청약 공고가 확인되면 여기에 표시됩니다.</p>
        </div>
      )}

      {groups.open.length > 0 && (
        <section className="group">
          <h2 className="group__title">
            지금 접수중 <em>{groups.open.length}</em>
          </h2>
          {groups.open.map((n) => (
            <NoticeCard key={n.id} notice={n} now={now} subscribed={n.id in subs} />
          ))}
        </section>
      )}

      {groups.upcoming.length > 0 && (
        <section className="group">
          <h2 className="group__title">
            접수 예정 <em>{groups.upcoming.length}</em>
          </h2>
          {groups.upcoming.map((n) => (
            <NoticeCard key={n.id} notice={n} now={now} subscribed={n.id in subs} />
          ))}
        </section>
      )}

      {groups.finished.length > 0 && (
        <section className="group">
          <h2 className="group__title">
            마감·취소 <em>{groups.finished.length}</em>
          </h2>
          {groups.finished.map((n) => (
            <NoticeCard key={n.id} notice={n} now={now} subscribed={n.id in subs} />
          ))}
        </section>
      )}
    </div>
  );
}
