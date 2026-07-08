// @zoopzoopcall/core 공개 API. 전부 플랫폼 무관 순수함수다.
export type { Notice, NoticeType, NoticeStatus } from "./notice/types";
export { getNoticeStatus, isClosingSoon } from "./notice/status";
export {
  normalizeRemndrItem,
  normalizeRemndrItems,
  resolveNoticeType,
  kstDateToUtcIso,
  DEFAULT_RECEIPT_START_KST,
  DEFAULT_RECEIPT_END_KST,
} from "./notice/normalize";
export type { RawRemndrItem } from "./notice/normalize";
export {
  KST_TZ,
  kstDateKey,
  ddayKst,
  formatKstDateTime,
  formatKstDate,
  formatRemaining,
  formatManwon,
} from "./time/kst";
export {
  buildNoticeAlerts,
  offsetLabel,
  DEFAULT_OPEN_OFFSETS,
  DEFAULT_CLOSE_OFFSETS,
} from "./alarm/buildNoticeAlerts";
export type { AlertKind, NoticeAlert } from "./alarm/buildNoticeAlerts";
