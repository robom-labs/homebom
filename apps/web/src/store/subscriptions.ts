// 알림 구독과 발송 이력을 localStorage에 보관하는 저장소.
import { latestNoticeAlertDate, safeParseNotice, type Notice } from "@zoopzoopcall/core";

// 구독 공고 스냅샷은 마지막 관련 일정(발표·계약 포함) 다음 날까지 보존한다.
// receiptEnd만으로 정리하면 발표·계약 알림이 울리기 전에 공고가 사라진다.
const SNAPSHOT_RETAIN_GRACE_MS = 86_400_000;
function shouldRetainSnapshot(notice: Notice): boolean {
  return notice.cancelled !== true && latestNoticeAlertDate(notice) + SNAPSHOT_RETAIN_GRACE_MS >= Date.now();
}

export type SubEntry = { open: number[]; close: number[]; eventIds?: string[] };
export type SubMap = Record<string, SubEntry>;
export type NoticeSnapshotMap = Record<string, Notice>;

const SUBS_KEY = "zzc:subs:v2";
const LEGACY_SUBS_KEY = "zzc:subs:v1";
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

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSubs(): SubMap {
  const current = readJson<SubMap>(SUBS_KEY, {});
  if (Object.keys(current).length > 0) return current;
  const legacy = readJson<SubMap>(LEGACY_SUBS_KEY, {});
  if (Object.keys(legacy).length > 0) writeJson(SUBS_KEY, legacy);
  return legacy;
}

export function saveSubs(subs: SubMap): void {
  writeJson(SUBS_KEY, subs);
  // 이전 버전 앱이 같은 저장소를 읽어도 구독을 잃지 않도록 v1도 당분간 함께 유지한다.
  writeJson(LEGACY_SUBS_KEY, subs);
}

export function loadNoticeSnapshots(): NoticeSnapshotMap {
  const stored = readJson<NoticeSnapshotMap>(NOTICE_SNAPSHOTS_KEY, {});
  const active = Object.fromEntries(Object.entries(stored).filter(([, value]) => {
    const parsed = safeParseNotice(value);
    return parsed.success && shouldRetainSnapshot(parsed.data);
  }));
  if (Object.keys(active).length !== Object.keys(stored).length) writeJson(NOTICE_SNAPSHOTS_KEY, active);
  return active;
}

export function saveNoticeSnapshots(notices: NoticeSnapshotMap): void {
  const active = Object.fromEntries(Object.entries(notices).filter(([, notice]) => {
    const parsed = safeParseNotice(notice);
    return parsed.success && shouldRetainSnapshot(parsed.data);
  }));
  writeJson(NOTICE_SNAPSHOTS_KEY, active);
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
  if (dirty) writeJson(FIRED_KEY, fired);
  return fired;
}

export function markFired(id: string): void {
  const fired = readJson<Record<string, number>>(FIRED_KEY, {});
  fired[id] = Date.now();
  writeJson(FIRED_KEY, fired);
}

export function migrateLegacyNoticeKeys(
  notices: Notice[],
  subs: SubMap,
  snapshots: NoticeSnapshotMap,
): { subs: SubMap; snapshots: NoticeSnapshotMap; changed: boolean } {
  const nextSubs = { ...subs };
  const nextSnapshots = { ...snapshots };
  let changed = false;

  for (const notice of notices) {
    const legacyId = notice.legacyIds?.find((id) => id !== notice.id && id in nextSubs);
    if (!legacyId) continue;
    if (!(notice.id in nextSubs)) nextSubs[notice.id] = nextSubs[legacyId];
    delete nextSubs[legacyId];
    delete nextSnapshots[legacyId];
    nextSnapshots[notice.id] = notice;
    changed = true;
  }

  return { subs: nextSubs, snapshots: nextSnapshots, changed };
}
