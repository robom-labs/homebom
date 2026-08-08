// 마운트 시 실공고를 불러와 네이티브 화면 상태(로딩·연결없음·에러·비어있음·데이터)로 노출하는 훅이다.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { nativeNoticeFromCore } from "../domain/noticeMapping";
import type { NativeNotice } from "../domain/notice";
import { fetchNotices, type NoticeSource } from "../domain/noticesFeed";
import { shouldRefreshOnForeground } from "../domain/refreshPolicy";

/** Expo가 빌드시 인라인하는 공개 실공고 프록시 URL. 없으면 not-connected 상태로 간다. */
export const NOTICES_ENDPOINT = process.env.EXPO_PUBLIC_NOTICES_URL;
export const IS_NOTICES_CONFIGURED = Boolean(NOTICES_ENDPOINT);

export type UseNoticesState = {
  notices: NativeNotice[];
  source: NoticeSource;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  verifiedAt: string | null;
  reload: () => Promise<void>;
};

export function useNotices(): UseNoticesState {
  const [notices, setNotices] = useState<NativeNotice[]>([]);
  const [source, setSource] = useState<NoticeSource>("not-connected");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const lastLoadedAtRef = useRef(0);
  const loadingRef = useRef(false);

  const performLoad = useCallback(async (mode: "initial" | "manual" | "silent") => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (mode === "initial") setLoading(true);
    if (mode === "manual") setRefreshing(true);
    try {
      const result = await fetchNotices({ url: NOTICES_ENDPOINT, storage: AsyncStorage });
      setNotices(result.notices.map(nativeNoticeFromCore));
      setSource(result.source);
      setError(result.error);
      setVerifiedAt(result.verifiedAt);
      lastLoadedAtRef.current = Date.now();
    } finally {
      loadingRef.current = false;
      if (mode === "initial") setLoading(false);
      if (mode === "manual") setRefreshing(false);
    }
  }, []);

  const reload = useCallback(() => performLoad("manual"), [performLoad]);

  useEffect(() => {
    void performLoad("initial");
  }, [performLoad]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      if (!shouldRefreshOnForeground(lastLoadedAtRef.current, Date.now())) return;
      void performLoad("silent");
    });
    return () => subscription.remove();
  }, [performLoad]);

  return { notices, source, error, loading, refreshing, verifiedAt, reload };
}
