// 공고 데이터를 실공고 프록시(VITE_NOTICES_URL)에서만 로드하는 훅.
import { useCallback, useEffect, useRef, useState } from "react";
import { parseNoticeList, sanitizeNoticeUrls, type Notice } from "@zoopzoopcall/core";

// 서버가 고쳐지기 전 저장된 캐시나 구버전 응답의 깨진 외부 링크(`&amp;`)까지
// 렌더 전에 복구한다.
function prepareNotice(notice: Notice): Notice {
  return sanitizeNoticeUrls(notice);
}

export type NoticeSource = "live" | "stale" | "not-connected";
const LKG_KEY = "homebom:notices:lkg:v1";
export const LKG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type LastKnownGood = { notices: Notice[]; verifiedAt: string | null; savedAt: string };

export function loadLastKnownNotices(): LastKnownGood | null {
  try {
    const raw = globalThis.localStorage?.getItem(LKG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastKnownGood;
    if (!Array.isArray(parsed.notices) || typeof parsed.savedAt !== "string") return null;
    if (!Number.isFinite(Date.parse(parsed.savedAt)) || Date.now() - Date.parse(parsed.savedAt) > LKG_MAX_AGE_MS) {
      globalThis.localStorage?.removeItem(LKG_KEY);
      return null;
    }
    const validated = parseNoticeList(parsed.notices);
    const notices = validated.notices.filter(isActiveNotice).map(prepareNotice);
    if (validated.rejected.length > 0) console.warn("HomeBom LKG rejected rows", validated.rejected);
    if (notices.length === 0) {
      globalThis.localStorage?.removeItem(LKG_KEY);
      return null;
    }
    return { notices, savedAt: parsed.savedAt, verifiedAt: typeof parsed.verifiedAt === "string" ? parsed.verifiedAt : null };
  } catch {
    return null;
  }
}

export function saveLastKnownNotices(value: LastKnownGood): boolean {
  try {
    const validated = parseNoticeList(value.notices);
    const notices = validated.notices.filter(isActiveNotice).map(prepareNotice);
    if (notices.length === 0) return false;
    globalThis.localStorage?.setItem(LKG_KEY, JSON.stringify({ ...value, notices }));
    return true;
  } catch {
    return false;
  }
}

function isActiveNotice(notice: Notice): boolean {
  return notice.cancelled !== true && Date.parse(notice.receiptEnd) >= Date.now();
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

/** 요청이 이 시간 안에 응답하지 않으면 중단하고 에러 상태로 전환한다(무한 로딩 방지). */
const FETCH_TIMEOUT_MS = 10_000;

export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [source, setSource] = useState<NoticeSource>("not-connected");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const liveUrl = import.meta.env.VITE_NOTICES_URL as string | undefined;
    if (!liveUrl) {
      const cached = loadLastKnownNotices();
      setNotices(cached?.notices.map(prepareNotice) ?? []);
      setSource(cached ? "stale" : "not-connected");
      setVerifiedAt(cached?.verifiedAt ?? null);
      setError(cached ? "공식 연결을 찾지 못해 이 기기에 저장된 마지막 확인본을 보여드려요." : "실공고 연결이 아직 완료되지 않았습니다. 공고는 특정 시간에만 보이는 방식이 아닙니다.");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(liveUrl, { signal: controller.signal });
      const data = await res.json() as unknown;
      if (!res.ok || !Array.isArray(data)) {
        const message = typeof data === "object" && data !== null && "error" in data ? String(data.error) : `HTTP ${res.status}`;
        throw new Error(message);
      }
      const meta = noticeResponseMeta(res.headers);
      const parsed = parseNoticeList(data);
      if (parsed.rejected.length > 0) console.warn("HomeBom API rejected rows", parsed.rejected);
      const normalized = parsed.notices.filter(isActiveNotice).map(prepareNotice);
      if (data.length > 0 && normalized.length === 0) throw new Error("검증을 통과한 접수 가능 공고가 없습니다.");
      setNotices(normalized);
      setSource(meta.source);
      setVerifiedAt(meta.verifiedAt);
      if (meta.source === "live") {
        saveLastKnownNotices({ notices: normalized, verifiedAt: meta.verifiedAt, savedAt: new Date().toISOString() });
      }
    } catch (err) {
      const cached = loadLastKnownNotices();
      setNotices(cached?.notices.map(prepareNotice) ?? []);
      setSource(cached ? "stale" : "not-connected");
      setVerifiedAt(cached?.verifiedAt ?? null);
      const timedOut = controller.signal.aborted;
      setError(
        cached
          ? "공식 데이터 연결이 지연돼 이 기기에 저장된 마지막 확인본을 보여드려요. 신청 전 원문을 확인해 주세요."
          : timedOut
          ? "실공고 응답이 10초 안에 오지 않아 요청을 중단했습니다. 잠시 후 다시 시도해 주세요."
          : err instanceof Error
            ? err.message
            : "실공고를 불러오지 못했습니다.",
      );
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // PWA를 오래 켜둔 사용자가 낡은 공고를 계속 보지 않도록, 탭 복귀 시 10분 넘게
  // 지난 데이터만 조용히 다시 불러온다 (짧은 전환에는 재요청하지 않음).
  const lastLoadedAtRef = useRef(Date.now());
  useEffect(() => {
    if (!loading) lastLoadedAtRef.current = Date.now();
  }, [loading]);
  useEffect(() => {
    const REFRESH_AFTER_MS = 10 * 60 * 1000;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadedAtRef.current < REFRESH_AFTER_MS) return;
      void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  return { notices, source, error, loading, verifiedAt, reload: load };
}
