// @zoopzoopcall/core 공개 API. 전부 플랫폼 무관 순수함수다.
export type {
  ApplicationEvent,
  ApplicationEventKind,
  ApplicationRegionScope,
  Notice,
  NoticeType,
  NoticeStatus,
  NoticeModelSummary,
} from "./notice/types";
export { getNoticeStatus, isClosingSoon } from "./notice/status";
export {
  normalizeRemndrItem,
  normalizeRemndrItems,
  normalizeRemndrModels,
  normalizeAptItem,
  buildAptEvents,
  buildRemndrEvents,
  resolveNoticeType,
  kstDateToUtcIso,
  normalizeYmd,
  DEFAULT_RECEIPT_START_KST,
  DEFAULT_RECEIPT_END_KST,
  APPLY_HOME_URL,
  RECEIPT_NOTE,
} from "./notice/normalize";
export type { RawAptItem, RawRemndrItem, RawRemndrModelItem } from "./notice/normalize";
export { formatPriceRange } from "./notice/price";
export { formatArea, pyeongFromSqm, SQM_PER_PYEONG } from "./notice/area";
export { addressSearchCandidates, kakaoMapSearchUrl, naverMapSearchUrl } from "./notice/location";
export {
  formatHouseholdSummary,
  formatHouseTypeLabel,
  inferHousingCategory,
} from "./notice/housing";
export { enrichNoticeWithComplexProfile, findComplexProfile } from "./notice/complexProfiles";
export type { ComplexProfile } from "./notice/complexProfiles";
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
  buildEventAlerts,
  offsetLabel,
  DEFAULT_OPEN_OFFSETS,
  DEFAULT_CLOSE_OFFSETS,
} from "./alarm/buildNoticeAlerts";
export type { AlertKind, NoticeAlert } from "./alarm/buildNoticeAlerts";
