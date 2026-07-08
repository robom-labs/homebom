// 구독된 공고의 알림 시각을 감시해 도래하면 웹 알림을 울리는 스케줄러.
import type { Notice, NoticeAlert } from "@zoopzoopcall/core";
import { buildNoticeAlerts } from "@zoopzoopcall/core";
import type { NoticeSnapshotMap, SubMap } from "../store/subscriptions";
import { loadFired, markFired } from "../store/subscriptions";
import { showAppNotification } from "./notifications";

/** 아직 오지 않은(예정된) 알림 전체를 시간순으로 모은다. */
export function collectPendingAlerts(
  notices: Notice[],
  subs: SubMap,
  now: number,
  noticeSnapshots: NoticeSnapshotMap = {},
): NoticeAlert[] {
  const byId = new Map(Object.values(noticeSnapshots).map((n) => [n.id, n]));
  for (const notice of notices) byId.set(notice.id, notice);
  const out: NoticeAlert[] = [];
  for (const [noticeId, entry] of Object.entries(subs)) {
    const notice = byId.get(noticeId);
    if (!notice || notice.cancelled) continue;
    out.push(...buildNoticeAlerts(notice, "open", entry.open, now));
    out.push(...buildNoticeAlerts(notice, "close", entry.close, now));
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}

/** 발송 시각이 지났지만 아직 안 울린 알림. 6시간 넘게 지난 것은 버린다. */
export function collectDueAlerts(
  notices: Notice[],
  subs: SubMap,
  now: number,
  noticeSnapshots: NoticeSnapshotMap = {},
  graceMs = 6 * 3600_000,
): NoticeAlert[] {
  const fired = loadFired();
  return collectPendingAlerts(notices, subs, now - graceMs, noticeSnapshots).filter(
    (a) => a.fireAt <= now && !(a.id in fired),
  );
}

/** 15초 간격 + 화면 복귀 시점에 도래 알림을 확인해 울린다. 반환값은 정리 함수다. */
export function startAlertScheduler(
  getState: () => { notices: Notice[]; subs: SubMap; noticeSnapshots: NoticeSnapshotMap },
): () => void {
  const check = () => {
    const { notices, subs, noticeSnapshots } = getState();
    for (const alert of collectDueAlerts(notices, subs, Date.now(), noticeSnapshots)) {
      markFired(alert.id);
      void showAppNotification(alert.title, alert.body, alert.url, alert.id);
    }
  };
  const interval = window.setInterval(check, 15_000);
  const onVisible = () => {
    if (document.visibilityState === "visible") check();
  };
  document.addEventListener("visibilitychange", onVisible);
  check();
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
