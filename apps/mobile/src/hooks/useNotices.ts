// 마운트 시 실공고를 불러와 네이티브 화면 상태(로딩·연결없음·에러·비어있음·데이터)로 노출하는 훅이다.
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { nativeNoticeFromCore } from "../domain/noticeMapping";
import type { NativeNotice } from "../domain/notice";
import { fetchNotices, type NoticeSource } from "../domain/noticesFeed";

/** Expo가 빌드시 인라인하는 공개 실공고 프록시 URL. 없으면 not-connected 상태로 간다. */
export const NOTICES_ENDPOINT = process.env.EXPO_PUBLIC_NOTICES_URL;
export const IS_NOTICES_CONFIGURED = Boolean(NOTICES_ENDPOINT);

export type UseNoticesState = {
  notices: NativeNotice[];
  source: NoticeSource;
  error: string | null;
  loading: boolean;
  verifiedAt: string | null;
  reload: () => Promise<void>;
};

export function useNotices(): UseNoticesState {
  const [notices, setNotices] = useState<NativeNotice[]>([]);
  const [source, setSource] = useState<NoticeSource>("not-connected");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchNotices({ url: NOTICES_ENDPOINT, storage: AsyncStorage });
    setNotices(result.notices.map(nativeNoticeFromCore));
    setSource(result.source);
    setError(result.error);
    setVerifiedAt(result.verifiedAt);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { notices, source, error, loading, verifiedAt, reload: load };
}
