// 구독 스냅샷을 활성 피드와 대조해 "피드에서 내려간 공고"를 표시·해제하는 순수 로직.
import type { Notice } from "./types";

export type SnapshotFeedSyncResult = {
  snapshots: Record<string, Notice>;
  changed: boolean;
};

/**
 * 피드(활성 목록)에 더 이상 없는 구독 공고 스냅샷에 missingFromFeed를 기록한다.
 *
 * - 서버가 취소 공고를 피드에서 조용히 빼면 클라이언트는 취소를 알 수 없으므로,
 *   "접수 종료 전인데 피드에서 사라진" 스냅샷을 취소 후보로 표시해 알림을 멈춘다.
 * - 접수 종료(receiptEnd)가 이미 지난 스냅샷은 기존 만료 정리 흐름이 지우므로 건드리지 않는다.
 * - 피드에 다시 나타나면 표시를 해제해 알림이 재개되게 한다.
 * - 피드가 cancelled: true 톰스톤을 주는 경우도 같은 방식으로 표시한다.
 * - 반드시 피드가 완전한 활성 목록일 때(live 응답)만 호출한다.
 *   stale·부분 응답에서 호출하면 멀쩡한 공고를 내려간 것으로 오탐한다.
 */
export function markSnapshotsMissingFromFeed(
  feedNotices: Notice[],
  snapshots: Record<string, Notice>,
  now = Date.now(),
): SnapshotFeedSyncResult {
  const feedById = new Map(feedNotices.map((notice) => [notice.id, notice]));
  const next: Record<string, Notice> = { ...snapshots };
  let changed = false;

  for (const [id, snapshot] of Object.entries(snapshots)) {
    const feedNotice = feedById.get(id);
    if (feedNotice && feedNotice.cancelled !== true) {
      // 피드에 살아 있으면 취소 후보 표시를 해제한다.
      if (snapshot.missingFromFeed === true) {
        const { missingFromFeed: _omit, ...rest } = snapshot;
        next[id] = rest as Notice;
        changed = true;
      }
      continue;
    }
    // 접수 종료가 지난 스냅샷은 만료 정리 흐름 담당 — 여기서 취소 후보로 만들지 않는다.
    if (!Number.isFinite(Date.parse(snapshot.receiptEnd)) || Date.parse(snapshot.receiptEnd) < now) continue;
    if (snapshot.missingFromFeed !== true) {
      next[id] = { ...snapshot, missingFromFeed: true };
      changed = true;
    }
  }

  return { snapshots: next, changed };
}
