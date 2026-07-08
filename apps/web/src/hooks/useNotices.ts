// 공고 데이터를 실공고 프록시(VITE_NOTICES_URL)에서만 로드하는 훅.
import { useCallback, useEffect, useState } from "react";
import type { Notice } from "@zoopzoopcall/core";

export type NoticeSource = "live" | "not-connected";

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
    try {
      const res = await fetch(liveUrl);
      const data = (await res.json()) as Notice[] | { error?: string };
      if (!res.ok || !Array.isArray(data)) {
        throw new Error(Array.isArray(data) ? `HTTP ${res.status}` : data.error || `HTTP ${res.status}`);
      }
      setNotices(data);
      setSource("live");
    } catch (err) {
      setNotices([]);
      setSource("not-connected");
      setError(err instanceof Error ? err.message : "실공고를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { notices, source, error, loading, reload: load };
}
