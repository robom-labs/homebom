// 앱 셸: 라우팅, 데이터 로드, 알림 스케줄러를 묶는다.
import { useEffect, useRef } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { useNotices } from "./hooks/useNotices";
import { useSubscriptions } from "./hooks/useSubscriptions";
import { startAlertScheduler } from "./notify/scheduler";
import { AlertsScreen } from "./screens/AlertsScreen";
import { DetailScreen } from "./screens/DetailScreen";
import { InfoScreen } from "./screens/InfoScreen";
import { ListScreen } from "./screens/ListScreen";

export default function App() {
  const { notices, source, error, loading } = useNotices();
  const subscriptions = useSubscriptions();

  const stateRef = useRef({ notices, subs: subscriptions.subs });
  stateRef.current = { notices, subs: subscriptions.subs };

  useEffect(() => startAlertScheduler(() => stateRef.current), []);

  return (
    <HashRouter>
      <div className="app">
        <main className="app__main">
          <Routes>
            <Route
              path="/"
              element={
                <ListScreen
                  notices={notices}
                  source={source}
                  error={error}
                  loading={loading}
                  subs={subscriptions.subs}
                />
              }
            />
            <Route
              path="/notice/:id"
              element={<DetailScreen notices={notices} subscriptions={subscriptions} />}
            />
            <Route path="/alerts" element={<AlertsScreen notices={notices} subs={subscriptions.subs} />} />
            <Route path="/info" element={<InfoScreen source={source} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  );
}
