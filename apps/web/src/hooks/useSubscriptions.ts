// 공고별 알림 구독 상태를 관리하고 localStorage에 저장하는 훅.
import { useCallback, useState } from "react";
import { DEFAULT_CLOSE_OFFSETS, DEFAULT_OPEN_OFFSETS } from "@zoopzoopcall/core";
import type { AlertKind, Notice } from "@zoopzoopcall/core";
import type { NoticeSnapshotMap, SubMap } from "../store/subscriptions";
import { loadNoticeSnapshots, loadSubs, saveNoticeSnapshots, saveSubs } from "../store/subscriptions";

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
        [notice.id]: { open: [...DEFAULT_OPEN_OFFSETS], close: [...DEFAULT_CLOSE_OFFSETS] },
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
      const next = { ...noticeSnapshots };
      let changed = false;
      for (const notice of notices) {
        if (notice.id in subs && next[notice.id] !== notice) {
          next[notice.id] = notice;
          changed = true;
        }
      }
      if (changed) updateNoticeSnapshots(next);
    },
    [noticeSnapshots, subs, updateNoticeSnapshots],
  );

  const toggleOffset = useCallback(
    (id: string, kind: AlertKind, offset: number) => {
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

  return { subs, noticeSnapshots, isSubscribed, subscribe, unsubscribe, toggleOffset, syncNoticeSnapshots };
}
