// 구독된 공고의 알림 시각을 감시해 도래하면 웹 알림을 울리는 스케줄러.
import type { Notice, NoticeAlert } from "@zoopzoopcall/core";
import { buildNoticeAlerts } from "@zoopzoopcall/core";
import type { NoticeSnapshotMap, SubMap } from "../store/subscriptions";
import { loadFired, markFired } from "../store/subscriptions";
import { notificationSupport, showAppNotification } from "./notifications";

const delivering = new Set<string>();

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

/** 실제 표시가 성공한 알림만 발송 완료로 기록한다. */
export async function deliverDueAlert(
  alert: NoticeAlert,
  notify = showAppNotification,
  record = markFired,
): Promise<boolean> {
  if (delivering.has(alert.id)) return false;
  delivering.add(alert.id);
  try {
    const shown = await notify(alert.title, alert.body, alert.url, alert.id).catch(() => false);
    if (!shown) return false;
    record(alert.id);
    return true;
  } finally {
    delivering.delete(alert.id);
  }
}

/** 15초 간격 + 화면 복귀 시점에 도래 알림을 확인해 울린다. 반환값은 정리 함수다. */
export function startAlertScheduler(
  getState: () => { notices: Notice[]; subs: SubMap; noticeSnapshots: NoticeSnapshotMap },
): () => void {
  const check = () => {
    // ★ 권한이 아직 granted 가 아니면 아무것도 하지 않는다.
    // (showAppNotification 은 권한이 없으면 조용히 리턴하는데, 그 전에 markFired 를 부르면
    //  알림이 "울린 것"으로 표시돼 영구 억제된다 → 나중에 권한을 켜도 그 알림이 다시 안 온다.)
    // 권한이 없을 땐 fired 로 찍지 않고 넘어가, 권한 허용 후 유예시간(6h) 안이면 그때 울리게 한다.
    if (notificationSupport() !== "granted") return;
    const { notices, subs, noticeSnapshots } = getState();
    for (const alert of collectDueAlerts(notices, subs, Date.now(), noticeSnapshots)) {
      void deliverDueAlert(alert);
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
