// 알림 구독과 발송 이력을 localStorage에 보관하는 저장소.
import type { Notice } from "@zoopzoopcall/core";

export type SubEntry = { open: number[]; close: number[] };
export type SubMap = Record<string, SubEntry>;
export type NoticeSnapshotMap = Record<string, Notice>;

const SUBS_KEY = "zzc:subs:v1";
const FIRED_KEY = "zzc:fired:v1";
const NOTICE_SNAPSHOTS_KEY = "zzc:notice-snapshots:v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadSubs(): SubMap {
  return readJson<SubMap>(SUBS_KEY, {});
}

export function saveSubs(subs: SubMap): void {
  localStorage.setItem(SUBS_KEY, JSON.stringify(subs));
}

export function loadNoticeSnapshots(): NoticeSnapshotMap {
  return readJson<NoticeSnapshotMap>(NOTICE_SNAPSHOTS_KEY, {});
}

export function saveNoticeSnapshots(notices: NoticeSnapshotMap): void {
  localStorage.setItem(NOTICE_SNAPSHOTS_KEY, JSON.stringify(notices));
}

/** 발송된 알림 ID → 발송 시각(ms). 오래된 항목은 로드 시 정리한다. */
export function loadFired(): Record<string, number> {
  const fired = readJson<Record<string, number>>(FIRED_KEY, {});
  const cutoff = Date.now() - 7 * 86400_000;
  let dirty = false;
  for (const [id, at] of Object.entries(fired)) {
    if (at < cutoff) {
      delete fired[id];
      dirty = true;
    }
  }
  if (dirty) localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  return fired;
}

export function markFired(id: string): void {
  const fired = readJson<Record<string, number>>(FIRED_KEY, {});
  fired[id] = Date.now();
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
}
