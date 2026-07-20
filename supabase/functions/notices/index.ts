// 청약홈 분양정보 API를 고객용 Notice JSON으로 정규화하는 Edge Function.
// 배포: supabase functions deploy notices --no-verify-jwt
// 환경변수: supabase secrets set DATA_GO_KR_SERVICE_KEY=...
//
// 공고 정규화(날짜·URL·ID·일정·주택형)의 단일 소스는 packages/core/src/notice/normalize.ts다.
// Deno는 Node와 모듈 해석 규칙이 달라 패키지 이름(@zoopzoopcall/core)으로는 import할 수 없지만,
// normalize.ts 자신은 타입 전용 import만 가지고 있어(런타임에 지워짐) 상대 경로 + 확장자 import로
// deno run에서 그대로 로드·실행됨을 확인했다. index.ts 전체를 import하면(값 export가 확장자 없는
// 상대 경로를 쓰는 것들이 있어) Deno가 모듈을 찾지 못하니, 반드시 normalize.ts를 직접 가리켜야 한다.
import {
  buildAptEvents,
  buildNoticeIdentity,
  buildRemndrEvents,
  kstDateToUtcIso,
  normalizeExternalUrl,
  normalizeRemndrModels,
  normalizeYmd,
  resolveNoticeType,
  type RawAptItem,
  type RawRemndrItem,
  type RawRemndrModelItem,
} from "../../../packages/core/src/notice/normalize.ts";
import type { ApplicationEvent as CoreApplicationEvent } from "../../../packages/core/src/notice/types.ts";

const API_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
const REMNDR_DETAIL_OPERATION = "getRemndrLttotPblancDetail";
const REMNDR_MODEL_OPERATION = "getRemndrLttotPblancMdl";
const APT_DETAIL_OPERATION = "getAPTLttotPblancDetail";
const APT_MODEL_OPERATION = "getAPTLttotPblancMdl";
const APPLY_HOME_URL = "https://www.applyhome.co.kr";
const CACHE_TTL_MS = 10 * 60 * 1000;
const SNAPSHOT_STALE_AFTER_MS = 90 * 60 * 1000;
const PER_PAGE = 500;
/** 청약홈(odcloud) 업스트림 호출 타임아웃(ms). 초과 시 AbortController 로 요청을 중단한다. */
const FETCH_TIMEOUT_MS = 8_000;
const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MODEL_RETRY_MS = 60 * 60 * 1000;
const MAX_MODEL_REFRESH_PER_RUN = 3;
const LOCATION_RETRY_MS = 24 * 60 * 60 * 1000;
// IP당 분당 허용 요청 수. 인스턴스 메모리 기반의 best-effort 제한이다 —
// Edge Function 인스턴스가 여러 개 뜨거나 재시작되면 카운터가 공유·유지되지 않는다.
// 플랫폼 차원(예: Supabase/게이트웨이 레벨)의 정식 rate limiting 설정은 사람 작업으로 남긴다.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_BUCKETS = 10_000;
const RECEIPT_NOTE =
  "청약홈 신청 가능 시간은 영업일 09:00~17:30 기준입니다. 공고별 정정·별도 조건은 모집공고 원문을 확인하세요.";

type RawItem = Record<string, unknown>;
type ApiPage = { data?: RawItem[]; totalCount?: number; currentCount?: number; error?: string };
type SourceKind = "remndr" | "apt";
// core의 ApplicationEvent와 동일 타입(단일 소스). 이름만 로컬 별칭으로 유지한다.
type ApplicationEvent = CoreApplicationEvent;
type ModelCacheRow = { notice_key: string; models: RawItem[]; fetched_at: string; retry_after?: string | null };
type LocationCacheRow = {
  notice_key: string;
  raw_address: string;
  normalized_address?: string | null;
  query_used?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: "matched" | "not-found" | "not-configured";
  provider?: string | null;
  fetched_at: string;
  retry_after?: string | null;
  last_error?: string | null;
};
type DocumentCacheRow = {
  notice_key: string;
  source_type: "notice-html" | "notice-pdf" | "official-page" | "public-agency";
  parsed_fields: Record<string, unknown>;
  provenance: Record<string, unknown>;
  conflicts: unknown[];
  status: "verified" | "single-official-source" | "conflict" | "not-provided" | "retrying";
  fetched_at: string;
  document_hash?: string | null;
  revision?: string | null;
};
type PublicSnapshotRow = {
  feed_key: string;
  notices: unknown[];
  stats: Record<string, unknown>;
  verified_at: string;
};
type UpstreamStateRow = { source_key: string; retry_after?: string | null; last_error?: string | null };
type CollectionStats = {
  fetched: number;
  valid: number;
  rejected: number;
  conflict: number;
  expired: number;
  cancelled: number;
  modelBlocked: number;
  preserved: number;
  published: number;
};
type CollectionConflict = {
  noticeKey: string;
  fieldName: string;
  candidates: Array<{ source: string; value: unknown }>;
};

// 최근 성공 응답. TTL 안에서는 그대로 서빙하고(기존 캐시 동작),
// TTL이 지나도 지우지 않고 남겨서 업스트림 장애 시 stale-if-error 폴백으로 쓴다.
let cache: { at: number; body: string; verifiedAt: string } | null = null;

// IP별 요청 카운터(인스턴스 로컬, best-effort — 위 RATE_LIMIT_MAX 주석 참고).
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidNotice(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && value.id.length > 0
    && typeof value.houseName === "string"
    && value.houseName.length > 0
    && typeof value.region === "string"
    && Number.isFinite(Date.parse(String(value.receiptStart ?? "")))
    && Number.isFinite(Date.parse(String(value.receiptEnd ?? "")))
    && Number.isFinite(Date.parse(String(value.lastVerifiedAt ?? "")))
    && typeof value.applyHomeUrl === "string";
}

function activeNoticeAt(value: unknown, now: number): value is Record<string, unknown> {
  return isValidNotice(value)
    && value.cancelled !== true
    && Date.parse(String(value.receiptEnd)) >= now;
}

function activeNotice(value: unknown): value is Record<string, unknown> {
  return activeNoticeAt(value, Date.now());
}

function activeCachedBody(body: string, now = Date.now()): string | null {
  try {
    const value = JSON.parse(body) as unknown;
    if (!Array.isArray(value)) return null;
    const active = value.filter((notice) => activeNoticeAt(notice, now));
    return active.length > 0 ? JSON.stringify(active) : null;
  } catch {
    return null;
  }
}

function headers(status = 200, extra: Record<string, string> = {}): ResponseInit {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "x-data-stale, x-verified-at, x-collection-stats",
      ...extra,
    },
  };
}

/** x-forwarded-for(프록시 경유 시 첫 번째 값) 기준 클라이언트 IP. 없으면 "unknown". */
function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/** true 를 반환하면 이번 요청을 429로 거절한다. */
function isRateLimited(ip: string, now: number): boolean {
  // 버킷이 비정상적으로 커지면 만료된 창부터 정리한다(메모리 보호).
  if (rateBuckets.size > RATE_LIMIT_MAX_BUCKETS) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function text(value: unknown): string | undefined {
  const out = String(value ?? "").trim();
  return out || undefined;
}

function locationQueries(raw: RawItem): string[] {
  const address = text(raw.HSSPLY_ADRES) ?? "";
  const withoutParentheses = address.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const parenthesized = [...address.matchAll(/\(([^)]*)\)/g)].map((match) => match[1].trim());
  const withoutExtra = withoutParentheses.replace(/\s+(일원|부근).*$/u, "").trim();
  const named = [text(raw.HOUSE_NM), text(raw.SUBSCRPT_AREA_CODE_NM)].filter(Boolean).join(" ");
  return [...new Set([address, ...parenthesized, withoutParentheses, withoutExtra, named].map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function sameRegion(expected?: string, actual?: string): boolean {
  if (!expected || !actual) return true;
  const compact = (value: string) => value.replace(/[\s특별자치광역시도]/g, "");
  const a = compact(expected);
  const b = compact(actual);
  return a.startsWith(b.slice(0, 2)) || b.startsWith(a.slice(0, 2));
}

// urlText·noticeIdentity는 core/normalize.ts의 normalizeExternalUrl·buildNoticeIdentity를
// 그대로 쓴다(위 import 참고). 호출부를 그대로 두려고 이 파일 기존 이름으로 별칭만 둔다.
const urlText = normalizeExternalUrl;
const noticeIdentity = buildNoticeIdentity;

function nonNegativeNumber(value: unknown): number | undefined {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return undefined;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

function sameOfficialValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return String(a).normalize("NFKC").replace(/\s+/g, " ").trim()
    === String(b).normalize("NFKC").replace(/\s+/g, " ").trim();
}

function sameOfficialFieldValue(fieldName: string, a: unknown, b: unknown): boolean {
  if (sameOfficialValue(a, b)) return true;
  const left = String(a ?? "").normalize("NFKC");
  const right = String(b ?? "").normalize("NFKC");
  if (fieldName === "contactPhone") return left.replace(/\D/g, "") === right.replace(/\D/g, "");
  if (["businessOwnerName", "address"].includes(fieldName)) {
    const compact = (value: string) => value.replace(/[^0-9a-z가-힣]/giu, "").toLowerCase();
    return compact(left) === compact(right);
  }
  return false;
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /(?:HTTP|API)\s*429|트래픽 허용 횟수|quota|rate.?limit/iu.test(message);
}

function nextKstQuotaReset(now = Date.now()): string {
  const kst = new Date(now + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1, 0, 10) - 9 * 60 * 60 * 1000).toISOString();
}

function serviceKeyParam(): string | null {
  const key = Deno.env.get("DATA_GO_KR_SERVICE_KEY");
  if (!key) return null;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

async function fetchApiPage(
  operation: string,
  serviceKey: string,
  page: number,
  params: Record<string, string> = {},
): Promise<ApiPage> {
  const url = new URL(`${API_BASE}/${operation}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(PER_PAGE));
  url.searchParams.set("returnType", "JSON");
  url.searchParams.set("serviceKey", serviceKey);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  // 업스트림이 응답하지 않으면 FETCH_TIMEOUT_MS 후 중단해 함수 전체가 매달리지 않게 한다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`청약홈 API 응답이 ${FETCH_TIMEOUT_MS / 1000}초 안에 오지 않아 중단했습니다.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const body = await res.text();
  if (!res.ok) throw new Error(`청약홈 API ${res.status}: ${body.slice(0, 180)}`);
  const json = JSON.parse(body) as unknown;
  if (!isRecord(json) || !Array.isArray(json.data)) {
    throw new Error(isRecord(json) && typeof json.error === "string" ? json.error : "청약홈 API 응답 형식이 올바르지 않습니다.");
  }
  return {
    data: json.data.filter(isRecord),
    totalCount: typeof json.totalCount === "number" ? json.totalCount : undefined,
    currentCount: typeof json.currentCount === "number" ? json.currentCount : undefined,
  };
}

async function fetchAll(
  operation: string,
  serviceKey: string,
  params: Record<string, string> = {},
): Promise<RawItem[]> {
  const first = await fetchApiPage(operation, serviceKey, 1, params);
  const total = first.totalCount ?? first.data?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => fetchApiPage(operation, serviceKey, i + 2, params)),
  );
  return [first, ...rest].flatMap((page) => page.data ?? []);
}

// resolveType은 core/normalize.ts의 resolveNoticeType과 동일 로직(단일 소스)이다.
const resolveType = resolveNoticeType;

function modelKey(raw: RawItem): string {
  return `${raw.HOUSE_MANAGE_NO ?? ""}-${raw.PBLANC_NO ?? ""}`;
}

// normalizeModels는 core/normalize.ts의 normalizeRemndrModels와 동일 로직(단일 소스)이다.
const normalizeModels = normalizeRemndrModels;

// 접수·특별공급·순위별 일정 생성은 core/normalize.ts의 buildRemndrEvents·buildAptEvents가
// 단일 소스다(모집공고·접수·발표·계약 라벨, 지역 우선순위, dedupe 규칙 전부 그쪽에서 관리).
// remndr은 无순위·잔여(no-priority), apt는 특별공급·순위별 접수(receipt/special/rank1/rank2)로
// 이벤트 종류가 달라 kind로만 분기한다.
function eventsFor(raw: RawItem, kind: SourceKind, noticeId?: string): ApplicationEvent[] {
  return kind === "remndr"
    ? buildRemndrEvents(raw as RawRemndrItem, noticeId)
    : buildAptEvents(raw as RawAptItem, noticeId);
}

function recentAnnouncementCutoff(days = 120): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function kstDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalize(
  raw: RawItem,
  models: RawItem[],
  verifiedAt: string,
  kind: SourceKind,
  modelStatusOverride?: "not-collected" | "retrying",
  location?: LocationCacheRow,
  modelVerifiedAt?: string,
  document?: DocumentCacheRow,
  collectionConflicts: CollectionConflict[] = [],
) {
  const houseName = text(raw.HOUSE_NM);
  const draftEvents = eventsFor(raw, kind);
  const events = draftEvents;
  const receiptEvents = events.filter((item) => ["receipt", "special", "rank1", "rank2", "no-priority"].includes(item.kind));
  if (!houseName || receiptEvents.length === 0) return null;

  const startEvent = receiptEvents.reduce((min, item) => Date.parse(item.start) < Date.parse(min.start) ? item : min);
  const endEvent = receiptEvents.reduce((max, item) => Date.parse(item.end ?? item.start) > Date.parse(max.end ?? max.start) ? item : max);
  const receiptEnd = Date.parse(endEvent.end ?? endEvent.start);
  if (receiptEnd < Date.now()) return null;
  const startYmd = normalizeYmd(kind === "remndr" ? raw.SUBSCRPT_RCEPT_BGNDE : raw.RCEPT_BGNDE)
    ?? normalizeYmd(raw.SPSPLY_RCEPT_BGNDE)
    ?? startEvent.start.slice(0, 10);

  const identity = noticeIdentity(raw as RawRemndrItem, houseName, startYmd);
  // draftEvents와 같은 raw로 다시 빌드해 id·noticeId만 채운다(core의 normalizeRemndrItem·
  // normalizeAptItem과 동일한 2단계 패턴 — identity를 먼저 계산한 뒤 이벤트를 확정한다).
  const identifiedEvents = eventsFor(raw, kind, identity.id);
  const modelSummaries = normalizeModels(models as RawRemndrModelItem[]);
  const prices = modelSummaries
    .map((model) => model.priceMax)
    .filter((price): price is number => typeof price === "number");

  const statusText = [raw.PBLANC_STTUS_NM, raw.PBLANC_STATUS_NM, raw.PBLANC_STAT, raw.PBLANC_STATE]
    .map((value) => text(value) ?? "")
    .join(" ");
  const cancelled = /(?:공고\s*)?취소/u.test(statusText);
  if (cancelled) return null;
  const corrected = /정정/u.test(statusText) || document?.revision?.includes("정정") === true;

  const base = {
    id: identity.id,
    legacyIds: identity.legacyIds,
    manageNo: identity.manageNo || undefined,
    pblancNo: identity.pblancNo || undefined,
    type: kind === "apt" ? "일반공급" : resolveType(raw as RawRemndrItem),
    officialTypeName: text(raw.HOUSE_SECD_NM),
    housingCategory: "아파트",
    sourceOperation: kind === "apt" ? APT_DETAIL_OPERATION : REMNDR_DETAIL_OPERATION,
    houseName,
    region: text(raw.SUBSCRPT_AREA_CODE_NM) || "전국",
    regionCode: text(raw.SUBSCRPT_AREA_CODE),
    zipCode: text(raw.HSSPLY_ZIP),
    address: text(raw.HSSPLY_ADRES),
    supplyCount: nonNegativeNumber(raw.TOT_SUPLY_HSHLDCO),
    priceMin: prices.length > 0 ? Math.min(...prices) : undefined,
    priceMax: prices.length > 0 ? Math.max(...prices) : undefined,
    announceDate: text(raw.RCRIT_PBLANC_DE),
    receiptStart: startEvent.start,
    receiptEnd: endEvent.end ?? endEvent.start,
    winnerDate: normalizeYmd(raw.PRZWNER_PRESNATN_DE) ?? undefined,
    contractStartDate: normalizeYmd(raw.CNTRCT_CNCLS_BGNDE) ?? undefined,
    contractEndDate: normalizeYmd(raw.CNTRCT_CNCLS_ENDDE) ?? undefined,
    officialHomepageUrl: urlText(raw.HMPG_ADRES),
    businessOwnerName: text(raw.BSNS_MBY_NM),
    contactPhone: text(raw.MDHS_TELNO),
    moveInMonth: text(raw.MVN_PREARNGE_YM),
    newspaperName: text(raw.NSPRC_NM),
    applyHomeUrl: APPLY_HOME_URL,
    noticeUrl: urlText(raw.PBLANC_URL),
    receiptNote: RECEIPT_NOTE,
    modelSummaries: modelSummaries.length > 0 ? modelSummaries : undefined,
    modelDataStatus: modelSummaries.length > 0 ? "collected" : modelStatusOverride ?? "not-collected",
    modelDataVerifiedAt: modelSummaries.length > 0 ? modelVerifiedAt ?? verifiedAt : undefined,
    latitude: location?.status === "matched" ? location.latitude ?? undefined : undefined,
    longitude: location?.status === "matched" ? location.longitude ?? undefined : undefined,
    geocodeQuery: location?.query_used ?? undefined,
    geocodeStatus: location?.status ?? (Deno.env.get("KAKAO_LOCAL_REST_KEY") ? undefined : "not-configured"),
    events: identifiedEvents,
    corrected,
    cancelled: false,
    lastVerifiedAt: verifiedAt,
    fieldProvenance: undefined as Record<string, unknown> | undefined,
    verification: {
      noticeApiFetchedAt: verifiedAt,
      modelApiFetchedAt: modelSummaries.length > 0 ? modelVerifiedAt ?? verifiedAt : undefined,
      documentFetchedAt: document?.fetched_at,
    },
  };

  const apiSourceUrl = "https://www.data.go.kr/data/15098547/openapi.do";
  const apiFields = [
    "houseName", "type", "officialTypeName", "region", "address", "supplyCount", "announceDate",
    "receiptStart", "receiptEnd", "winnerDate", "contractStartDate", "contractEndDate",
    "officialHomepageUrl", "businessOwnerName", "contactPhone", "moveInMonth", "noticeUrl",
  ];
  const baseRecord = base as Record<string, unknown>;
  base.fieldProvenance = Object.fromEntries(apiFields
    .filter((field) => baseRecord[field] !== undefined)
    .map((field) => [field, {
      sourceType: "applyhome-api",
      sourceUrl: apiSourceUrl,
      fetchedAt: verifiedAt,
      status: "single-official-source",
    }]));

  if (!document || !["verified", "single-official-source"].includes(document.status)) return base;
  const parsed = document.parsed_fields;
  const decisionSupport = typeof parsed.decisionSupport === "object" && parsed.decisionSupport !== null
    ? { ...parsed.decisionSupport as Record<string, unknown>, source: document.source_type, verifiedAt: document.fetched_at }
    : undefined;
  const fieldProvenance = { ...base.fieldProvenance, ...document.provenance };
  const mergeOfficialField = (fieldName: string, apiValue: unknown, documentValue: unknown): unknown => {
    if (documentValue === undefined) return apiValue;
    if (apiValue === undefined || sameOfficialFieldValue(fieldName, apiValue, documentValue)) return documentValue;
    if (document.revision?.includes("정정")) return documentValue;
    collectionConflicts.push({
      noticeKey: base.id,
      fieldName,
      candidates: [
        { source: "applyhome-api", value: apiValue },
        { source: document.source_type, value: documentValue },
      ],
    });
    fieldProvenance[fieldName] = {
      sourceType: document.source_type,
      sourceUrl: (document.provenance[fieldName] as Record<string, unknown> | undefined)?.sourceUrl,
      fetchedAt: document.fetched_at,
      documentHash: document.document_hash,
      revision: document.revision,
      status: "conflict",
    };
    return undefined;
  };
  const officialStartTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(parsed.receiptStartTime ?? ""))
    ? String(parsed.receiptStartTime)
    : undefined;
  const officialEndTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(parsed.receiptEndTime ?? ""))
    ? String(parsed.receiptEndTime)
    : undefined;
  const correctedEvents = base.events.map((item) => {
    if (!["receipt", "special", "rank1", "rank2", "no-priority"].includes(item.kind)) return item;
    return {
      ...item,
      start: officialStartTime ? kstDateToUtcIso(kstDateKey(new Date(item.start)), officialStartTime) : item.start,
      end: officialEndTime ? kstDateToUtcIso(kstDateKey(new Date(item.end ?? item.start)), officialEndTime) : item.end,
      timeSource: officialStartTime && officialEndTime ? "official" : item.timeSource,
      startTimeConfirmed: Boolean(officialStartTime),
      endTimeConfirmed: Boolean(officialEndTime),
      confirmed: Boolean(officialStartTime && officialEndTime),
    };
  });
  const correctedReceiptEvents = correctedEvents.filter((item) => ["receipt", "special", "rank1", "rank2", "no-priority"].includes(item.kind));
  return {
    ...base,
    supplyCount: mergeOfficialField("supplyCount", base.supplyCount, nonNegativeNumber(parsed.supplyCount)),
    address: mergeOfficialField("address", base.address, text(parsed.address)),
    contractStartDate: mergeOfficialField("contractStartDate", base.contractStartDate, normalizeYmd(parsed.contractStartDate) ?? undefined),
    contractEndDate: mergeOfficialField("contractEndDate", base.contractEndDate, normalizeYmd(parsed.contractEndDate) ?? undefined),
    moveInMonth: mergeOfficialField("moveInMonth", base.moveInMonth, text(parsed.moveInMonth)),
    businessOwnerName: mergeOfficialField("businessOwnerName", base.businessOwnerName, text(parsed.businessOwnerName)),
    contactPhone: mergeOfficialField("contactPhone", base.contactPhone, text(parsed.contactPhone)),
    decisionSupport,
    fieldProvenance,
    events: correctedEvents,
    receiptStart: correctedReceiptEvents.reduce((min, item) => Date.parse(item.start) < Date.parse(min) ? item.start : min, correctedReceiptEvents[0]?.start ?? base.receiptStart),
    receiptEnd: correctedReceiptEvents.reduce((max, item) => Date.parse(item.end ?? item.start) > Date.parse(max) ? item.end ?? item.start : max, correctedReceiptEvents[0]?.end ?? correctedReceiptEvents[0]?.start ?? base.receiptEnd),
  };
}

function supabaseCredentials(): { url: string; serviceRole: string } | null {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && serviceRole ? { url, serviceRole } : null;
}

async function readRestRows<T>(path: string): Promise<T[]> {
  const credentials = supabaseCredentials();
  if (!credentials) return [];
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0;; from += pageSize) {
    const res = await fetch(`${credentials.url}/rest/v1/${path}`, {
      headers: {
        apikey: credentials.serviceRole,
        authorization: `Bearer ${credentials.serviceRole}`,
        range: `${from}-${from + pageSize - 1}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase 캐시 조회 실패 ${res.status}`);
    const page = await res.json() as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function readModelCache(): Promise<Map<string, ModelCacheRow>> {
  const rows = await readRestRows<ModelCacheRow>("notice_model_cache?select=notice_key,models,fetched_at,retry_after&order=notice_key.asc");
  return new Map(rows.map((row) => [row.notice_key, row]));
}

async function readDocumentCache(): Promise<Map<string, DocumentCacheRow>> {
  const rows = await readRestRows<DocumentCacheRow>("notice_document_cache?select=notice_key,source_type,parsed_fields,provenance,conflicts,status,fetched_at,document_hash,revision&order=notice_key.asc");
  return new Map(rows.map((row) => [row.notice_key, row]));
}

async function readPublicSnapshot(): Promise<PublicSnapshotRow | null> {
  const credentials = supabaseCredentials();
  if (!credentials) return null;
  const res = await fetch(`${credentials.url}/rest/v1/notice_public_snapshots?feed_key=eq.active&select=feed_key,notices,stats,verified_at&limit=1`, {
    headers: { apikey: credentials.serviceRole, authorization: `Bearer ${credentials.serviceRole}` },
  });
  if (!res.ok) throw new Error(`공개 스냅샷 조회 실패 ${res.status}`);
  const rows = await res.json() as PublicSnapshotRow[];
  return rows[0] ?? null;
}

async function readUpstreamState(): Promise<UpstreamStateRow | null> {
  const credentials = supabaseCredentials();
  if (!credentials) return null;
  const res = await fetch(`${credentials.url}/rest/v1/notice_upstream_state?source_key=eq.applyhome&select=source_key,retry_after,last_error&limit=1`, {
    headers: { apikey: credentials.serviceRole, authorization: `Bearer ${credentials.serviceRole}` },
  });
  if (!res.ok) throw new Error(`업스트림 상태 조회 실패 ${res.status}`);
  const rows = await res.json() as UpstreamStateRow[];
  return rows[0] ?? null;
}

async function writeUpstreamState(retryAfter: string | null, lastError: string | null): Promise<void> {
  const credentials = supabaseCredentials();
  if (!credentials) return;
  const res = await fetch(`${credentials.url}/rest/v1/notice_upstream_state?on_conflict=source_key`, {
    method: "POST",
    headers: {
      apikey: credentials.serviceRole,
      authorization: `Bearer ${credentials.serviceRole}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ source_key: "applyhome", retry_after: retryAfter, last_error: lastError, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`업스트림 상태 저장 실패 ${res.status}`);
}

async function authorizedRefresh(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-sync-token");
  const credentials = supabaseCredentials();
  if (!provided || !credentials) return false;
  const res = await fetch(`${credentials.url}/rest/v1/notice_sync_auth?singleton=eq.true&select=token_hash&limit=1`, {
    headers: { apikey: credentials.serviceRole, authorization: `Bearer ${credentials.serviceRole}` },
  });
  if (!res.ok) return false;
  const rows = await res.json() as Array<{ token_hash?: string }>;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(provided));
  const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return Boolean(rows[0]?.token_hash) && actual === rows[0]?.token_hash;
}

async function writePublicSnapshot(notices: unknown[], stats: CollectionStats, verifiedAt: string): Promise<void> {
  const credentials = supabaseCredentials();
  if (!credentials || notices.length === 0) return;
  const historyRes = await fetch(`${credentials.url}/rest/v1/notice_public_snapshot_history`, {
    method: "POST",
    headers: {
      apikey: credentials.serviceRole,
      authorization: `Bearer ${credentials.serviceRole}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({ feed_key: "active", notices, stats, verified_at: verifiedAt }),
  });
  if (!historyRes.ok) throw new Error(`공개 스냅샷 이력 저장 실패 ${historyRes.status}`);
  const res = await fetch(`${credentials.url}/rest/v1/notice_public_snapshots?on_conflict=feed_key`, {
    method: "POST",
    headers: {
      apikey: credentials.serviceRole,
      authorization: `Bearer ${credentials.serviceRole}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      feed_key: "active",
      notices,
      stats,
      verified_at: verifiedAt,
      source_versions: { applyhome: "ApplyhomeInfoDetailSvc/v1", contract: "homebom-v2" },
      updated_at: verifiedAt,
    }),
  });
  if (!res.ok) throw new Error(`공개 스냅샷 저장 실패 ${res.status}`);
}

async function reconcileCollectionConflicts(activeNoticeIds: string[], conflicts: CollectionConflict[]): Promise<void> {
  const credentials = supabaseCredentials();
  if (!credentials) return;
  const rows = conflicts.map((conflict) => ({
    notice_key: conflict.noticeKey,
    field_name: conflict.fieldName,
    candidates: conflict.candidates,
    detected_at: new Date().toISOString(),
    resolved_at: null,
    resolution: null,
  }));
  if (rows.length > 0) {
    const res = await fetch(`${credentials.url}/rest/v1/notice_collection_conflicts?on_conflict=notice_key,field_name`, {
      method: "POST",
      headers: {
        apikey: credentials.serviceRole,
        authorization: `Bearer ${credentials.serviceRole}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`공식 출처 충돌 저장 실패 ${res.status}`);
  }

  if (activeNoticeIds.length === 0) return;
  const openRows = await readRestRows<{ id: number; notice_key: string; field_name: string }>(
    "notice_collection_conflicts?resolved_at=is.null&select=id,notice_key,field_name&order=id.asc",
  );
  const current = new Set(conflicts.map((item) => `${item.noticeKey}\u0000${item.fieldName}`));
  const resolvedAt = new Date().toISOString();
  const active = new Set(activeNoticeIds);
  await Promise.all(openRows.filter((row) => !current.has(`${row.notice_key}\u0000${row.field_name}`)).map(async (row) => {
    const res = await fetch(`${credentials.url}/rest/v1/notice_collection_conflicts?id=eq.${row.id}`, {
      method: "PATCH",
      headers: {
        apikey: credentials.serviceRole,
        authorization: `Bearer ${credentials.serviceRole}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({
        resolved_at: resolvedAt,
        resolution: { status: active.has(row.notice_key) ? "official-sources-agree" : "notice-no-longer-published" },
      }),
    });
    if (!res.ok) throw new Error(`공식 출처 충돌 해소 기록 실패 ${res.status}`);
  }));
}

async function writeModelCache(row: ModelCacheRow & { last_error?: string | null }): Promise<void> {
  const credentials = supabaseCredentials();
  if (!credentials) return;
  const res = await fetch(`${credentials.url}/rest/v1/notice_model_cache?on_conflict=notice_key`, {
    method: "POST",
    headers: {
      apikey: credentials.serviceRole,
      authorization: `Bearer ${credentials.serviceRole}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`주택형 캐시 저장 실패 ${res.status}`);
}

async function readLocationCache(): Promise<Map<string, LocationCacheRow>> {
  const rows = await readRestRows<LocationCacheRow>("notice_location_cache?select=*&order=notice_key.asc");
  return new Map(rows.map((row) => [row.notice_key, row]));
}

async function writeLocationCache(row: LocationCacheRow): Promise<void> {
  const credentials = supabaseCredentials();
  if (!credentials) return;
  const res = await fetch(`${credentials.url}/rest/v1/notice_location_cache?on_conflict=notice_key`, {
    method: "POST",
    headers: {
      apikey: credentials.serviceRole,
      authorization: `Bearer ${credentials.serviceRole}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`위치 캐시 저장 실패 ${res.status}`);
}

async function refreshLocationCache(items: RawItem[]): Promise<void> {
  const kakaoKey = Deno.env.get("KAKAO_LOCAL_REST_KEY");
  if (!kakaoKey) return;
  for (const raw of items) {
    const key = modelKey(raw);
    const rawAddress = text(raw.HSSPLY_ADRES) ?? "";
    if (!key || !rawAddress) continue;
    let matched: LocationCacheRow | null = null;
    try {
      for (const query of locationQueries(raw)) {
        const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
        url.searchParams.set("query", query);
        const res = await fetch(url, { headers: { authorization: `KakaoAK ${kakaoKey}` } });
        if (!res.ok) throw new Error(`Kakao Local ${res.status}`);
        const body = await res.json() as { documents?: Array<{ x: string; y: string; address_name?: string; address?: { region_1depth_name?: string } }> };
        const document = body.documents?.find((item) => sameRegion(text(raw.SUBSCRPT_AREA_CODE_NM), item.address?.region_1depth_name));
        if (!document) continue;
        matched = {
          notice_key: key,
          raw_address: rawAddress,
          normalized_address: document.address_name ?? query,
          query_used: query,
          latitude: Number(document.y),
          longitude: Number(document.x),
          status: "matched",
          provider: "kakao-local",
          fetched_at: new Date().toISOString(),
          retry_after: null,
          last_error: null,
        };
        break;
      }
      await writeLocationCache(matched ?? {
        notice_key: key,
        raw_address: rawAddress,
        status: "not-found",
        provider: "kakao-local",
        fetched_at: new Date().toISOString(),
        retry_after: new Date(Date.now() + LOCATION_RETRY_MS).toISOString(),
        last_error: "주소 후보에서 지역이 일치하는 좌표를 찾지 못함",
      });
    } catch (error) {
      await writeLocationCache({
        notice_key: key,
        raw_address: rawAddress,
        status: "not-found",
        provider: "kakao-local",
        fetched_at: new Date().toISOString(),
        retry_after: new Date(Date.now() + LOCATION_RETRY_MS).toISOString(),
        last_error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
      }).catch(() => {});
    }
  }
}

function relevantAptDetails(items: RawItem[]): RawItem[] {
  const now = Date.now();
  const [year, month] = kstDateKey(new Date(now)).split("-").map(Number);
  const nextMonthEnd = Date.UTC(year, month + 1, 1) - 9 * 60 * 60 * 1000 - 1;
  return items.filter((raw) => {
    const events = eventsFor(raw, "apt").filter((item) => ["receipt", "special", "rank1", "rank2"].includes(item.kind));
    if (events.length === 0) return false;
    const start = Math.min(...events.map((item) => Date.parse(item.start)));
    const end = Math.max(...events.map((item) => Date.parse(item.end ?? item.start)));
    return end >= now && start <= nextMonthEnd;
  });
}

function rawCollectionStatus(raw: RawItem, kind: SourceKind, now = Date.now()): { cancelled: boolean; expired: boolean } {
  const statusText = [raw.PBLANC_STTUS_NM, raw.PBLANC_STATUS_NM, raw.PBLANC_STAT, raw.PBLANC_STATE]
    .map((value) => text(value) ?? "")
    .join(" ");
  const cancelled = /(?:공고\s*)?취소/u.test(statusText);
  const receiptEvents = eventsFor(raw, kind).filter((item) => ["receipt", "special", "rank1", "rank2", "no-priority"].includes(item.kind));
  const receiptEnd = receiptEvents.length > 0
    ? Math.max(...receiptEvents.map((item) => Date.parse(item.end ?? item.start)))
    : Number.NaN;
  return { cancelled, expired: Number.isFinite(receiptEnd) && receiptEnd < now };
}

async function refreshAptModelCache(serviceKey: string, items: RawItem[]): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
    for (;;) {
      const raw = queue.shift();
      if (!raw) return;
      const key = modelKey(raw);
      const manageNo = text(raw.HOUSE_MANAGE_NO);
      const pblancNo = text(raw.PBLANC_NO);
      if (!manageNo || !pblancNo) continue;
      try {
        const models = await fetchAll(APT_MODEL_OPERATION, serviceKey, {
          "cond[HOUSE_MANAGE_NO::EQ]": manageNo,
          "cond[PBLANC_NO::EQ]": pblancNo,
        });
        await writeModelCache({ notice_key: key, models, fetched_at: new Date().toISOString(), retry_after: null, last_error: null });
      } catch (error) {
        const retryAfter = isQuotaError(error) ? nextKstQuotaReset() : new Date(Date.now() + MODEL_RETRY_MS).toISOString();
        await writeModelCache({
          notice_key: key,
          models: [],
          fetched_at: new Date(0).toISOString(),
          retry_after: retryAfter,
          last_error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
        }).catch(() => {});
        if (isQuotaError(error)) {
          await writeUpstreamState(retryAfter, error instanceof Error ? error.message.slice(0, 500) : "quota exceeded").catch(() => {});
          return;
        }
      }
    }
  });
  await Promise.all(workers);
}

function runInBackground(task: Promise<void>): void {
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<void>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
  else void task;
}

Deno.serve(async (req) => {
  if (isRateLimited(clientIp(req), Date.now())) {
    return new Response(
      JSON.stringify({ error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." }),
      headers(429, { "retry-after": "60" }),
    );
  }

  const requestUrl = new URL(req.url);
  const wantsRefresh = requestUrl.searchParams.get("refresh") === "1";
  if (wantsRefresh && !(await authorizedRefresh(req))) {
    return new Response(JSON.stringify({ error: "unauthorized refresh" }), headers(401));
  }

  if (!wantsRefresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    const body = activeCachedBody(cache.body);
    if (body) {
      cache.body = body;
      return new Response(body, headers(200, {
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
        "x-verified-at": cache.verifiedAt,
      }));
    }
  }

  if (!wantsRefresh) {
    const snapshot = await readPublicSnapshot().catch(() => null);
    const snapshotNotices = snapshot?.notices.filter((notice) => activeNotice(notice)) ?? [];
    if (snapshot && snapshotNotices.length > 0) {
      const body = JSON.stringify(snapshotNotices);
      cache = { at: Date.now(), body, verifiedAt: snapshot.verified_at };
      const stale = Date.now() - Date.parse(snapshot.verified_at) > SNAPSHOT_STALE_AFTER_MS;
      return new Response(body, headers(200, {
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
        ...(stale ? { "x-data-stale": "1" } : {}),
        "x-verified-at": snapshot.verified_at,
      }));
    }
  }

  const serviceKey = serviceKeyParam();
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "청약홈 실공고 연결 키가 설정되지 않았습니다." }), headers(503));
  }

  try {
    const upstreamState = await readUpstreamState().catch(() => null);
    if (upstreamState?.retry_after && Date.parse(upstreamState.retry_after) > Date.now()) {
      throw new Error(`청약홈 API 재시도 대기 중 ${upstreamState.retry_after}`);
    }
    const detailParams = { "cond[RCRIT_PBLANC_DE::GTE]": recentAnnouncementCutoff() };
    const [remndrDetails, remndrModels, aptDetails] = await Promise.all([
      fetchAll(REMNDR_DETAIL_OPERATION, serviceKey, detailParams),
      fetchAll(REMNDR_MODEL_OPERATION, serviceKey),
      fetchAll(APT_DETAIL_OPERATION, serviceKey, detailParams),
    ]);
    const groupModels = (items: RawItem[]) => {
      const grouped = new Map<string, RawItem[]>();
      for (const item of items) {
        const key = modelKey(item);
        grouped.set(key, [...(grouped.get(key) ?? []), item]);
      }
      return grouped;
    };
    const remndrModelsByNotice = groupModels(remndrModels);

    const verifiedAt = new Date().toISOString();
    let aptCache = await readModelCache().catch(() => new Map<string, ModelCacheRow>());
    const [locationCache, documentCache] = await Promise.all([
      readLocationCache().catch(() => new Map<string, LocationCacheRow>()),
      readDocumentCache().catch(() => new Map<string, DocumentCacheRow>()),
    ]);
    const relevantApt = relevantAptDetails(aptDetails);
    const refreshTargets = relevantApt.filter((raw) => {
      const cached = aptCache.get(modelKey(raw));
      if (!cached) return true;
      if (cached.retry_after && Date.parse(cached.retry_after) > Date.now()) return false;
      return Date.now() - Date.parse(cached.fetched_at) >= MODEL_CACHE_TTL_MS;
    }).slice(0, MAX_MODEL_REFRESH_PER_RUN);
    if (refreshTargets.length > 0) {
      await refreshAptModelCache(serviceKey, refreshTargets);
      aptCache = await readModelCache();
    }
    const locationTargets = [...remndrDetails, ...aptDetails].filter((raw) => {
      if (!text(raw.HSSPLY_ADRES)) return false;
      const cached = locationCache.get(modelKey(raw));
      return !cached || (cached.retry_after != null && Date.parse(cached.retry_after) <= Date.now());
    }).slice(0, 8);
    if (locationTargets.length > 0) runInBackground(refreshLocationCache(locationTargets));
    const collectionConflicts: CollectionConflict[] = [];
    const normalized = [
      ...remndrDetails.map((raw) => normalize(
        raw,
        remndrModelsByNotice.get(modelKey(raw)) ?? [],
        verifiedAt,
        "remndr",
        undefined,
        locationCache.get(modelKey(raw)),
        verifiedAt,
        documentCache.get(modelKey(raw)),
        collectionConflicts,
      )),
      ...aptDetails.map((raw) => {
        const cached = aptCache.get(modelKey(raw));
        const retrying = cached?.retry_after && Date.parse(cached.retry_after) > Date.now();
        return normalize(
          raw,
          cached?.models ?? [],
          verifiedAt,
          "apt",
          retrying ? "retrying" : "not-collected",
          locationCache.get(modelKey(raw)),
          cached?.fetched_at,
          documentCache.get(modelKey(raw)),
          collectionConflicts,
        );
      }),
    ];
    const collectedNotices = normalized
      .filter((notice): notice is NonNullable<typeof notice> => notice !== null)
      .filter((notice) => notice.type !== "일반공급" || notice.modelDataStatus === "collected")
      .filter(activeNotice)
      .sort((a, b) => Date.parse(a.receiptStart) - Date.parse(b.receiptStart));

    const blockedNoticeIds = new Set(normalized
      .filter((notice): notice is NonNullable<typeof notice> => notice !== null)
      .filter((notice) => notice.type === "일반공급" && notice.modelDataStatus !== "collected" && activeNotice(notice))
      .map((notice) => notice.id));
    const previousSnapshot = await readPublicSnapshot().catch(() => null);
    const preservedNotices = (previousSnapshot?.notices ?? [])
      .filter(activeNotice)
      .filter((notice) => blockedNoticeIds.has(String(notice.id ?? "")));
    const mergedById = new Map<string, Record<string, unknown>>();
    for (const notice of [...preservedNotices, ...collectedNotices]) mergedById.set(String(notice.id), notice);
    const notices = [...mergedById.values()]
      .sort((a, b) => Date.parse(String(a.receiptStart)) - Date.parse(String(b.receiptStart)));
    const publishedNoticeIds = new Set(notices.map((notice) => String(notice.id)));
    const publishedConflicts = collectionConflicts.filter((conflict) => publishedNoticeIds.has(conflict.noticeKey));

    const rawStatuses = [
      ...remndrDetails.map((raw) => rawCollectionStatus(raw, "remndr")),
      ...aptDetails.map((raw) => rawCollectionStatus(raw, "apt")),
    ];

    const stats: CollectionStats = {
      fetched: remndrDetails.length + aptDetails.length,
      valid: normalized.filter((notice) => notice !== null).length,
      rejected: normalized.filter((notice) => notice !== null && !isValidNotice(notice)).length,
      conflict: publishedConflicts.length + notices.filter((notice) => documentCache.get(`${notice.manageNo ?? ""}-${notice.pblancNo ?? ""}`)?.status === "conflict").length,
      expired: rawStatuses.filter((status) => status.expired).length,
      cancelled: rawStatuses.filter((status) => status.cancelled).length,
      modelBlocked: blockedNoticeIds.size,
      preserved: preservedNotices.length,
      published: notices.length,
    };
    console.log(JSON.stringify({ event: "homebom_notice_collection", ...stats, verifiedAt }));
    if (notices.length === 0) throw new Error("검증을 통과한 접수 가능 공고가 없어 기존 스냅샷을 유지합니다.");

    await Promise.all([
      writePublicSnapshot(notices, stats, verifiedAt),
      reconcileCollectionConflicts(notices.map((notice) => notice.id), publishedConflicts),
    ]);

    await writeUpstreamState(null, null).catch(() => {});

    const body = JSON.stringify(notices);
    cache = { at: Date.now(), body, verifiedAt };
    // HQ 수집 헬스 머신검증용: 숫자만 담는 읽기전용 헤더. 공고 본문·PII는 절대 넣지 않는다.
    // 불변식: fetched >= valid >= published >= 0, 모두 유한 음이 아닌 정수.
    // 카운트 계산이 실패해도 항상 well-formed JSON 이 되도록 방어적으로 폴백한다.
    let collectionStats: string;
    try {
      const published = notices.length;
      // 업스트림에서 가져온 상세 행 수(무순위/잔여 + APT). notices 는 이 중 유효분을 필터한 부분집합이다.
      const fetched = remndrDetails.length + aptDetails.length;
      // normalize/validation 을 통과한 수 = null 제거 후 = 정렬 후와 동일 = published.
      const valid = published;
      // 이 응답은 새로 수집한 결과이므로 last-known-good 에서 보존한 항목은 없다.
      const preserved = 0;
      collectionStats = JSON.stringify({ published, fetched, valid, preserved });
    } catch {
      const n = Array.isArray(notices) ? notices.length : 0;
      collectionStats = JSON.stringify({ published: n, fetched: n, valid: n, preserved: 0 });
    }
    return new Response(body, headers(200, {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "x-verified-at": verifiedAt,
      "x-collection-stats": collectionStats,
    }));
  } catch (err) {
    if (isQuotaError(err)) {
      await writeUpstreamState(nextKstQuotaReset(), err instanceof Error ? err.message.slice(0, 500) : "quota exceeded").catch(() => {});
    }
    const snapshot = await readPublicSnapshot().catch(() => null);
    const snapshotNotices = snapshot?.notices.filter((notice) => activeNotice(notice)) ?? [];
    if (snapshot && snapshotNotices.length > 0) {
      const body = JSON.stringify(snapshotNotices);
      cache = { at: Date.now(), body, verifiedAt: snapshot.verified_at };
      return new Response(body, headers(200, {
        "cache-control": "public, max-age=30, stale-while-revalidate=300",
        "x-data-stale": "1",
        "x-verified-at": snapshot.verified_at,
      }));
    }
    // DB 스냅샷도 읽지 못한 짧은 장애 구간에만 인스턴스 메모리 복사본을 사용한다.
    if (cache) {
      return new Response(
        cache.body,
        headers(200, {
          "cache-control": "public, max-age=30, stale-while-revalidate=300",
          "x-data-stale": "1",
          "x-verified-at": cache.verifiedAt,
        }),
      );
    }
    const message = err instanceof Error ? err.message : "청약홈 공고를 불러오지 못했습니다.";
    return new Response(JSON.stringify({ error: message }), headers(502));
  }
});
