// 실공고 프록시에서만 공고를 불러오고 마지막 확인본(LKG)을 관리하는 순수 로직이다.
import { parseNoticeList, sanitizeNoticeUrls, type Notice } from "@zoopzoopcall/core";

export type NoticeSource = "live" | "stale" | "not-connected";

/** 네이티브 전용 마지막 확인본 저장 키. 웹의 localStorage 키와 분리한다. */
export const LKG_KEY = "homebom:native:notices:lkg:v1";
export const LKG_MAX_AGE_MS = 72 * 60 * 60 * 1000;
/** 요청이 이 시간 안에 응답하지 않으면 중단하고 에러 상태로 전환한다(무한 로딩 방지). */
export const FETCH_TIMEOUT_MS = 10_000;

export const NOT_CONNECTED_MESSAGE =
  "실공고 연결이 아직 완료되지 않았습니다. 공고는 특정 시간에만 보이는 방식이 아닙니다.";
const NOT_CONNECTED_WITH_CACHE_MESSAGE =
  "공식 연결을 찾지 못해 이 기기에 저장된 마지막 확인본을 보여드려요. 신청 전 원문을 확인해 주세요.";
const STALE_MESSAGE =
  "공식 데이터 연결이 지연돼 이 기기에 저장된 마지막 확인본을 보여드려요. 신청 전 원문을 확인해 주세요.";
const TIMEOUT_MESSAGE = "실공고 응답이 10초 안에 오지 않아 요청을 중단했습니다. 잠시 후 다시 시도해 주세요.";
const GENERIC_ERROR_MESSAGE = "실공고를 불러오지 못했습니다.";
const NO_ACTIVE_MESSAGE = "검증을 통과한 접수 가능 공고가 없습니다.";

/** AsyncStorage와 테스트 목을 함께 받기 위한 최소 저장소 계약이다. */
export type AsyncKeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type LastKnownGood = { notices: Notice[]; verifiedAt: string | null; savedAt: string };

export type NoticesResult = {
  notices: Notice[];
  source: NoticeSource;
  error: string | null;
  verifiedAt: string | null;
};

/** 웹과 동일한 활성 조건: 취소되지 않았고 접수 마감이 아직 지나지 않은 공고. */
export function isActiveNotice(notice: Notice, now = Date.now()): boolean {
  return notice.cancelled !== true && Date.parse(notice.receiptEnd) >= now;
}

/** 저장 캐시나 구버전 응답의 깨진 외부 링크(`&amp;`)까지 렌더 전에 복구한다. */
export function prepareNotice(notice: Notice): Notice {
  return sanitizeNoticeUrls(notice);
}

function sortByReceiptEnd(notices: Notice[]): Notice[] {
  return [...notices].sort((a, b) => Date.parse(a.receiptEnd) - Date.parse(b.receiptEnd));
}

export function noticeResponseMeta(headers: Headers): {
  source: Exclude<NoticeSource, "not-connected">;
  verifiedAt: string | null;
} {
  return {
    source: headers.get("x-data-stale") === "1" ? "stale" : "live",
    verifiedAt: headers.get("x-verified-at"),
  };
}

export async function loadLastKnownNotices(
  storage: AsyncKeyValueStore,
  now = Date.now(),
): Promise<LastKnownGood | null> {
  try {
    const raw = await storage.getItem(LKG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastKnownGood;
    if (!Array.isArray(parsed.notices) || typeof parsed.savedAt !== "string") return null;
    const savedMs = Date.parse(parsed.savedAt);
    if (!Number.isFinite(savedMs) || now - savedMs > LKG_MAX_AGE_MS) {
      await storage.removeItem(LKG_KEY);
      return null;
    }
    const validated = parseNoticeList(parsed.notices);
    const notices = sortByReceiptEnd(validated.notices.filter((notice) => isActiveNotice(notice, now)).map(prepareNotice));
    if (validated.rejected.length > 0) console.warn("HomeBom LKG rejected rows", validated.rejected);
    if (notices.length === 0) {
      await storage.removeItem(LKG_KEY);
      return null;
    }
    return {
      notices,
      savedAt: parsed.savedAt,
      verifiedAt: typeof parsed.verifiedAt === "string" ? parsed.verifiedAt : null,
    };
  } catch {
    return null;
  }
}

export async function saveLastKnownNotices(
  storage: AsyncKeyValueStore,
  value: LastKnownGood,
): Promise<boolean> {
  try {
    const validated = parseNoticeList(value.notices);
    const notices = validated.notices.filter((notice) => isActiveNotice(notice)).map(prepareNotice);
    if (notices.length === 0) return false;
    await storage.setItem(LKG_KEY, JSON.stringify({ ...value, notices }));
    return true;
  } catch {
    return false;
  }
}

export type FetchNoticesOptions = {
  url: string | undefined;
  storage: AsyncKeyValueStore;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/**
 * 웹 훅과 같은 규칙으로 실공고를 불러온다. URL이 없으면 데이터를 지어내지 않고
 * LKG(있으면 stale) 또는 not-connected로 떨어진다. 에러·타임아웃 시에도 동일하게 LKG로 폴백한다.
 */
export async function fetchNotices({
  url,
  storage,
  fetchImpl = fetch,
  now = () => Date.now(),
}: FetchNoticesOptions): Promise<NoticesResult> {
  if (!url) {
    const cached = await loadLastKnownNotices(storage, now());
    if (cached) {
      return { notices: cached.notices, source: "stale", error: NOT_CONNECTED_WITH_CACHE_MESSAGE, verifiedAt: cached.verifiedAt };
    }
    return { notices: [], source: "not-connected", error: NOT_CONNECTED_MESSAGE, verifiedAt: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    const data = (await res.json()) as unknown;
    if (!res.ok || !Array.isArray(data)) {
      const message = typeof data === "object" && data !== null && "error" in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`;
      throw new Error(message);
    }
    const meta = noticeResponseMeta(res.headers);
    const parsed = parseNoticeList(data);
    if (parsed.rejected.length > 0) console.warn("HomeBom API rejected rows", parsed.rejected);
    const normalized = sortByReceiptEnd(parsed.notices.filter((notice) => isActiveNotice(notice, now())).map(prepareNotice));
    if (data.length > 0 && normalized.length === 0) throw new Error(NO_ACTIVE_MESSAGE);
    if (meta.source === "live") {
      await saveLastKnownNotices(storage, { notices: normalized, verifiedAt: meta.verifiedAt, savedAt: new Date(now()).toISOString() });
    }
    return { notices: normalized, source: meta.source, error: null, verifiedAt: meta.verifiedAt };
  } catch (err) {
    const cached = await loadLastKnownNotices(storage, now());
    if (cached) {
      return { notices: cached.notices, source: "stale", error: STALE_MESSAGE, verifiedAt: cached.verifiedAt };
    }
    const timedOut = controller.signal.aborted;
    const message = timedOut ? TIMEOUT_MESSAGE : err instanceof Error ? err.message : GENERIC_ERROR_MESSAGE;
    return { notices: [], source: "not-connected", error: message, verifiedAt: null };
  } finally {
    clearTimeout(timeout);
  }
}
