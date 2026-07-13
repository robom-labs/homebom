// 공고 데이터를 실공고 프록시(VITE_NOTICES_URL)에서만 로드하는 훅.
import { useCallback, useEffect, useState } from "react";
import { enrichNoticeWithComplexProfile, sanitizeNoticeUrls, type Notice } from "@zoopzoopcall/core";

// 서버가 고쳐지기 전 저장된 캐시나 구버전 응답의 깨진 외부 링크(`&amp;`)까지
// 렌더 전에 복구한다.
function prepareNotice(notice: Notice): Notice {
  return sanitizeNoticeUrls(enrichNoticeWithComplexProfile(notice));
}

export type NoticeSource = "live" | "stale" | "not-connected";
const LKG_KEY = "homebom:notices:lkg:v1";

type LastKnownGood = { notices: Notice[]; verifiedAt: string | null; savedAt: string };

export function loadLastKnownNotices(): LastKnownGood | null {
  try {
    const raw = globalThis.localStorage?.getItem(LKG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastKnownGood;
    return Array.isArray(parsed.notices) && typeof parsed.savedAt === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastKnownNotices(value: LastKnownGood): boolean {
  try {
    globalThis.localStorage?.setItem(LKG_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
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
      const data = (await res.json()) as Notice[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) {
        throw new Error(Array.isArray(data) ? `HTTP ${res.status}` : data.error || `HTTP ${res.status}`);
      }
      const meta = noticeResponseMeta(res.headers);
      const normalized = data.map(prepareNotice);
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

  return { notices, source, error, loading, verifiedAt, reload: load };
}
