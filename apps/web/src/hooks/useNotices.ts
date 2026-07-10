// 공고 데이터를 실공고 프록시(VITE_NOTICES_URL)에서만 로드하는 훅.
import { useCallback, useEffect, useState } from "react";
import type { Notice } from "@zoopzoopcall/core";

export type NoticeSource = "live" | "not-connected";

/** 요청이 이 시간 안에 응답하지 않으면 중단하고 에러 상태로 전환한다(무한 로딩 방지). */
const FETCH_TIMEOUT_MS = 10_000;

export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [source, setSource] = useState<NoticeSource>("not-connected");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const liveUrl = import.meta.env.VITE_NOTICES_URL as string | undefined;
    if (!liveUrl) {
      setNotices([]);
      setSource("not-connected");
      setError("실공고 연결이 아직 완료되지 않았습니다. 공고는 특정 시간에만 보이는 방식이 아닙니다.");
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
      setNotices(data);
      setSource("live");
    } catch (err) {
      setNotices([]);
      setSource("not-connected");
      const timedOut = controller.signal.aborted;
      setError(
        timedOut
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

  return { notices, source, error, loading, reload: load };
}
