// 내 알림 화면. 예약된 알림 목록과 권한 안내를 제공한다.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import { formatKstDateTime } from "@zoopzoopcall/core";
import { PermissionBanner } from "../components/PermissionBanner";
import { useNow } from "../hooks/useNow";
import { collectPendingAlerts } from "../notify/scheduler";
import type { NoticeSnapshotMap, SubMap } from "../store/subscriptions";

type Props = {
  notices: Notice[];
  subs: SubMap;
  noticeSnapshots: NoticeSnapshotMap;
};

export function AlertsScreen({ notices, subs, noticeSnapshots }: Props) {
  const now = useNow(15_000);

  const pending = useMemo(
    () => collectPendingAlerts(notices, subs, now, noticeSnapshots),
    [notices, noticeSnapshots, subs, now],
  );
  const byId = useMemo(() => {
    const map = new Map(Object.values(noticeSnapshots).map((n) => [n.id, n]));
    for (const notice of notices) map.set(notice.id, notice);
    return map;
  }, [notices, noticeSnapshots]);

  return (
    <div className="screen">
      <header className="masthead">
        <h1 className="masthead__brand masthead__brand--sub">내 알림</h1>
      </header>

      <PermissionBanner />

      {pending.length === 0 ? (
        <div className="empty">
          <p className="empty__title">예약된 알림이 없어요</p>
          <p className="empty__body">공고 상세에서 [알림 받기]를 켜면 여기에 모입니다.</p>
          <Link to="/" className="btn btn--ghost">
            공고 보러 가기
          </Link>
        </div>
      ) : (
        <section className="group">
          <h2 className="group__title">
            예약된 알림 <em>{pending.length}</em>
          </h2>
          {pending.map((a) => {
            const n = byId.get(a.noticeId);
            return (
              <Link key={a.id} to={`/notice/${a.noticeId}`} className="alert-row">
                <div className="alert-row__time">{formatKstDateTime(new Date(a.fireAt).toISOString())}</div>
                <div className="alert-row__title">{a.title}</div>
                {n && <div className="alert-row__meta">{n.region} · {n.type}</div>}
              </Link>
            );
          })}
        </section>
      )}

      <div className="notice-bar notice-bar--muted">
        알림을 켠 공고는 저장된 일정 기준으로 유지됩니다. 공고가 목록에서 잠시 빠졌다가 다시 확인되면
        최신 일정으로 갱신됩니다. 현재 알림은 앱이 실행 중일 때 동작합니다.
      </div>
    </div>
  );
}
