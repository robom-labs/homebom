// 내 알림 화면. 예약된 알림 목록·테스트 알림·권한 안내를 제공한다.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import { formatKstDateTime } from "@zoopzoopcall/core";
import { PermissionBanner } from "../components/PermissionBanner";
import { useNow } from "../hooks/useNow";
import { fireTestNotification, notificationSupport } from "../notify/notifications";
import { collectPendingAlerts } from "../notify/scheduler";
import type { SubMap } from "../store/subscriptions";

type Props = {
  notices: Notice[];
  subs: SubMap;
};

export function AlertsScreen({ notices, subs }: Props) {
  const now = useNow(15_000);
  const [testState, setTestState] = useState<"idle" | "armed">("idle");

  const pending = useMemo(() => collectPendingAlerts(notices, subs, now), [notices, subs, now]);
  const byId = useMemo(() => new Map(notices.map((n) => [n.id, n])), [notices]);

  const onTest = () => {
    fireTestNotification(5000);
    setTestState("armed");
    window.setTimeout(() => setTestState("idle"), 8000);
  };

  return (
    <div className="screen">
      <header className="masthead">
        <h1 className="masthead__brand masthead__brand--sub">내 알림</h1>
      </header>

      <PermissionBanner />

      {notificationSupport() === "granted" && (
        <div className="test-card">
          <div>
            <p className="test-card__title">알림이 잘 오는지 확인해 보세요</p>
            <p className="test-card__body">누르고 5초 뒤에 테스트 알림이 울립니다. 화면을 꺼도 좋아요.</p>
          </div>
          <button className="btn btn--primary btn--sm" onClick={onTest} disabled={testState === "armed"}>
            {testState === "armed" ? "5초 뒤 울려요…" : "테스트 알림"}
          </button>
        </div>
      )}

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
        이 버전(v0.1.0)의 알림은 줍줍콜이 폰 브라우저에 열려 있거나 홈 화면 앱으로 실행 중일 때
        울립니다. 완전히 종료된 상태에서도 오는 서버 푸시는 v0.2.0에서 제공할 예정이에요.
      </div>
    </div>
  );
}
