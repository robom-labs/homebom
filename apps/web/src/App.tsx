// 앱 셸: 라우팅, 데이터 로드, 알림 스케줄러를 묶는다.
import { lazy, Suspense, useEffect, useRef } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { useNotices } from "./hooks/useNotices";
import { useSubscriptions } from "./hooks/useSubscriptions";
import { startAlertScheduler } from "./notify/scheduler";
import { ListScreen } from "./screens/ListScreen";

const AlertsScreen = lazy(() => import("./screens/AlertsScreen").then((module) => ({ default: module.AlertsScreen })));
const DetailScreen = lazy(() => import("./screens/DetailScreen").then((module) => ({ default: module.DetailScreen })));
const InfoScreen = lazy(() => import("./screens/InfoScreen").then((module) => ({ default: module.InfoScreen })));

export default function App() {
  const { notices, source, error, loading, verifiedAt } = useNotices();
  const subscriptions = useSubscriptions();
  const { noticeSnapshots, subs, syncNoticeSnapshots } = subscriptions;

  useEffect(() => {
    syncNoticeSnapshots(notices);
  }, [notices, syncNoticeSnapshots]);

  const stateRef = useRef({
    notices,
    subs,
    noticeSnapshots,
  });
  stateRef.current = {
    notices,
    subs,
    noticeSnapshots,
  };

  useEffect(() => startAlertScheduler(() => stateRef.current), []);

  return (
    <HashRouter>
      <div className="app">
        <main className="app__main">
          <Suspense fallback={<p className="empty" role="status">화면을 준비하고 있어요…</p>}>
          <Routes>
            <Route
              path="/"
              element={
                <ListScreen
                  notices={notices}
                  source={source}
                  error={error}
                  loading={loading}
                  verifiedAt={verifiedAt}
                  subs={subs}
                />
              }
            />
            <Route
              path="/notice/:id"
              element={<DetailScreen notices={notices} subscriptions={subscriptions} />}
            />
            <Route
              path="/alerts"
              element={
                <AlertsScreen
                  notices={notices}
                  subs={subs}
                  noticeSnapshots={noticeSnapshots}
                />
              }
            />
            <Route path="/info" element={<Navigate to="/settings" replace />} />
            <Route path="/settings" element={<InfoScreen source={source} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  );
}
