// 공고별 알림 구독 상태를 관리하고 localStorage에 저장하는 훅.
import { useCallback, useState } from "react";
import { DEFAULT_CLOSE_OFFSETS, DEFAULT_OPEN_OFFSETS } from "@zoopzoopcall/core";
import type { AlertKind } from "@zoopzoopcall/core";
import type { SubMap } from "../store/subscriptions";
import { loadSubs, saveSubs } from "../store/subscriptions";

export function useSubscriptions() {
  const [subs, setSubs] = useState<SubMap>(() => loadSubs());

  const update = useCallback((next: SubMap) => {
    setSubs(next);
    saveSubs(next);
  }, []);

  const isSubscribed = useCallback((id: string) => id in subs, [subs]);

  const subscribe = useCallback(
    (id: string) => {
      update({
        ...subs,
        [id]: { open: [...DEFAULT_OPEN_OFFSETS], close: [...DEFAULT_CLOSE_OFFSETS] },
      });
    },
    [subs, update],
  );

  const unsubscribe = useCallback(
    (id: string) => {
      const next = { ...subs };
      delete next[id];
      update(next);
    },
    [subs, update],
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

  return { subs, isSubscribed, subscribe, unsubscribe, toggleOffset };
}
