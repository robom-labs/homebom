// 공고 데이터를 실시간 프록시(VITE_NOTICES_URL) 또는 샘플에서 로드하는 훅.
import { useCallback, useEffect, useState } from "react";
import type { Notice } from "@zoopzoopcall/core";
import { generateSampleNotices } from "../data/sampleNotices";
import { loadSampleAnchor } from "../store/subscriptions";

export type NoticeSource = "live" | "sample";

export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [source, setSource] = useState<NoticeSource>("sample");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const liveUrl = import.meta.env.VITE_NOTICES_URL as string | undefined;
    if (liveUrl) {
      try {
        const res = await fetch(liveUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Notice[];
        setNotices(data);
        setSource("live");
        setLoading(false);
        return;
      } catch {
        setError("실시간 공고를 불러오지 못해 샘플 데이터를 보여드립니다.");
      }
    }
    setNotices(generateSampleNotices(loadSampleAnchor()));
    setSource("sample");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { notices, source, error, loading, reload: load };
}
