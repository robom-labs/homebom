// 공고별 알림 구독 상태를 관리하고 localStorage에 저장하는 훅.
import { useCallback, useState } from "react";
import { DEFAULT_CLOSE_OFFSETS, DEFAULT_OPEN_OFFSETS } from "@zoopzoopcall/core";
import type { AlertKind, Notice } from "@zoopzoopcall/core";
import type { NoticeSnapshotMap, SubMap } from "../store/subscriptions";
import {
  loadNoticeSnapshots,
  loadSubs,
  migrateLegacyNoticeKeys,
  saveNoticeSnapshots,
  saveSubs,
} from "../store/subscriptions";

export function useSubscriptions() {
  const [subs, setSubs] = useState<SubMap>(() => loadSubs());
  const [noticeSnapshots, setNoticeSnapshots] = useState<NoticeSnapshotMap>(() => loadNoticeSnapshots());

  const update = useCallback((next: SubMap) => {
    setSubs(next);
    saveSubs(next);
  }, []);

  const updateNoticeSnapshots = useCallback((next: NoticeSnapshotMap) => {
    setNoticeSnapshots(next);
    saveNoticeSnapshots(next);
  }, []);

  const isSubscribed = useCallback((id: string) => id in subs, [subs]);

  const subscribe = useCallback(
    (notice: Notice) => {
      update({
        ...subs,
        [notice.id]: {
          open: [...DEFAULT_OPEN_OFFSETS],
          close: [...DEFAULT_CLOSE_OFFSETS],
          eventIds: notice.events?.filter((item) => ["special", "rank1", "rank2", "no-priority", "winner", "contract"].includes(item.kind)).map((item) => item.id).filter((value): value is string => Boolean(value)) ?? [],
        },
      });
      updateNoticeSnapshots({ ...noticeSnapshots, [notice.id]: notice });
    },
    [noticeSnapshots, subs, update, updateNoticeSnapshots],
  );

  const unsubscribe = useCallback(
    (id: string) => {
      const next = { ...subs };
      delete next[id];
      update(next);
      const nextSnapshots = { ...noticeSnapshots };
      delete nextSnapshots[id];
      updateNoticeSnapshots(nextSnapshots);
    },
    [noticeSnapshots, update, updateNoticeSnapshots, subs],
  );

  const syncNoticeSnapshots = useCallback(
    (notices: Notice[]) => {
      const migrated = migrateLegacyNoticeKeys(notices, subs, noticeSnapshots);
      if (migrated.changed) update(migrated.subs);
      const next = { ...migrated.snapshots };
      let changed = false;
      for (const notice of notices) {
        if (notice.id in migrated.subs && JSON.stringify(next[notice.id]) !== JSON.stringify(notice)) {
          next[notice.id] = notice;
          changed = true;
        }
      }
      if (migrated.changed || changed) updateNoticeSnapshots(next);
    },
    [noticeSnapshots, subs, update, updateNoticeSnapshots],
  );

  const toggleOffset = useCallback(
    (id: string, kind: Exclude<AlertKind, "event">, offset: number) => {
      const entry = subs[id] ?? { open: [], close: [] };
      const list = entry[kind];
      const nextList = list.includes(offset)
        ? list.filter((o) => o !== offset)
        : [...list, offset].sort((a, b) => b - a);
      const nextEntry = { ...entry, [kind]: nextList };
      if (nextEntry.open.length === 0 && nextEntry.close.length === 0) {
        unsubscribe(id);
        return;
      }
      update({ ...subs, [id]: nextEntry });
    },
    [subs, unsubscribe, update],
  );

  const toggleEvent = useCallback((id: string, eventId: string) => {
    const entry = subs[id];
    if (!entry) return;
    const current = entry.eventIds ?? [];
    const eventIds = current.includes(eventId) ? current.filter((value) => value !== eventId) : [...current, eventId];
    update({ ...subs, [id]: { ...entry, eventIds } });
  }, [subs, update]);

  return { subs, noticeSnapshots, isSubscribed, subscribe, unsubscribe, toggleOffset, toggleEvent, syncNoticeSnapshots };
}
