// 청약홈 분양정보 API를 고객용 Notice JSON으로 정규화하는 Edge Function.
// 배포: supabase functions deploy notices --no-verify-jwt
// 환경변수: supabase secrets set DATA_GO_KR_SERVICE_KEY=...

const API_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
const REMNDR_DETAIL_OPERATION = "getRemndrLttotPblancDetail";
const REMNDR_MODEL_OPERATION = "getRemndrLttotPblancMdl";
const APT_DETAIL_OPERATION = "getAPTLttotPblancDetail";
const APT_MODEL_OPERATION = "getAPTLttotPblancMdl";
const APPLY_HOME_URL = "https://www.applyhome.co.kr";
const CACHE_TTL_MS = 10 * 60 * 1000;
const PER_PAGE = 500;
/** 청약홈(odcloud) 업스트림 호출 타임아웃(ms). 초과 시 AbortController 로 요청을 중단한다. */
const FETCH_TIMEOUT_MS = 8_000;
const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MODEL_RETRY_MS = 60 * 60 * 1000;
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
type ApplicationEvent = {
  id?: string;
  noticeId?: string;
  kind: "announce" | "receipt" | "special" | "rank1" | "rank2" | "no-priority" | "winner" | "contract";
  label: string;
  start: string;
  end?: string;
  regionScope?: "local" | "gyeonggi" | "other" | "all" | "not-applicable";
  confirmed?: boolean;
  sourceField?: string;
};
type ModelCacheRow = { notice_key: string; models: RawItem[]; fetched_at: string; retry_after?: string | null };

// 공개 분양자료를 대조한 총세대수다. core의 complexProfiles.ts와 같은 값을 유지한다.
const COMPLEX_PROFILES = [
  { houseName: "대방역 여의도 더로드캐슬", addressToken: "신길동 449-11", totalHouseholdCount: 46, sourceUrl: "https://www.smilebunyang.com/yeouido-the-road-castle", verifiedAt: "2026-07-12" },
  { houseName: "루원시티 SK 리더스뷰", addressToken: "가정로 437", totalHouseholdCount: 1789, sourceUrl: "https://www.skview.co.kr/html/info/?dp1=const&dp2=constRate&idx=230&month=1&pg=2&year=2022", verifiedAt: "2026-07-12" },
  { houseName: "오정 해모로 스마트시티", addressToken: "오정동 613", totalHouseholdCount: 200, sourceUrl: "https://www.wikitree.co.kr/articles/1138871", verifiedAt: "2026-07-12" },
  { houseName: "힐스테이트 앞산 센트럴", addressToken: "대덕로 162", totalHouseholdCount: 345, sourceUrl: "https://www.mss.go.kr/common/board/Download.do?bcIdx=1029213&cbIdx=253&streFileNm=5b939e30-e4bf-49a6-81ad-f8098cb15fc6.pdf", verifiedAt: "2026-07-12" },
  { houseName: "힐스테이트 시흥더클래스", addressToken: "대야동", totalHouseholdCount: 430, sourceUrl: "https://siheunghillstate.co.kr/", verifiedAt: "2026-07-12" },
  { houseName: "청계 노르웨이숲", addressToken: "황학동", totalHouseholdCount: 404, sourceUrl: "https://www.khba.or.kr/user/isale/isaleInfo.do?busiResuSeq=3&memSeq=2011-0784", verifiedAt: "2026-07-12" },
  { houseName: "수원역 아너스빌 타임원", addressToken: "평동 135-1", totalHouseholdCount: 114, sourceUrl: "https://www.honorsville.co.kr/estate/sale/list", verifiedAt: "2026-07-12" },
  { houseName: "호반써밋 풍무Ⅱ", addressToken: "사우동 527-1", totalHouseholdCount: 961, sourceUrl: "https://www.wikitree.co.kr/articles/1139229", verifiedAt: "2026-07-12" },
];

// 최근 성공 응답. TTL 안에서는 그대로 서빙하고(기존 캐시 동작),
// TTL이 지나도 지우지 않고 남겨서 업스트림 장애 시 stale-if-error 폴백으로 쓴다.
let cache: { at: number; body: string; verifiedAt: string } | null = null;

// IP별 요청 카운터(인스턴스 로컬, best-effort — 위 RATE_LIMIT_MAX 주석 참고).
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

function headers(status = 200, extra: Record<string, string> = {}): ResponseInit {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "x-data-stale, x-verified-at",
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

function kstDateToUtcIso(dateYmd: string, timeHm: string): string {
  return new Date(`${dateYmd}T${timeHm}:00+09:00`).toISOString();
}

// core/normalize.ts의 normalizeYmd와 동일 규칙. 두 파일 결과가 어긋나지 않게 함께 유지한다.
function normalizeYmd(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!match) return null;
  const ymd = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isNaN(Date.parse(`${ymd}T00:00:00+09:00`)) ? null : ymd;
}

function text(value: unknown): string | undefined {
  const out = String(value ?? "").trim();
  return out || undefined;
}

function normalizeHouseName(value: string): string {
  return value.replace(/\([^)]*\)/g, "").replace(/\s+/g, "").trim();
}

function findComplexProfile(houseName: string, address?: string) {
  if (!address) return undefined;
  const normalizedName = normalizeHouseName(houseName);
  return COMPLEX_PROFILES.find(
    (profile) =>
      normalizeHouseName(profile.houseName) === normalizedName && address.includes(profile.addressToken),
  );
}

function urlText(value: unknown): string | undefined {
  const out = text(value);
  if (!out) return undefined;
  if (/[\u0000-\u001F\u007F]/.test(out)) return undefined;
  const candidate = /^www\./i.test(out) ? `https://${out}` : out;
  try {
    const url = new URL(candidate);
    if (!url.hostname || (url.protocol !== "https:" && url.protocol !== "http:")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function stableIdPart(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^0-9a-z가-힣_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function noticeIdentity(raw: RawItem, houseName: string, receiptStartYmd: string) {
  const manageNo = String(raw.HOUSE_MANAGE_NO ?? "").trim();
  const pblancNo = String(raw.PBLANC_NO ?? "").trim();
  const legacyId = `${manageNo}-${pblancNo}`;
  if (manageNo && pblancNo) return { id: legacyId, legacyIds: undefined, manageNo, pblancNo };
  const id = manageNo
    ? `manage-${stableIdPart(manageNo)}-${receiptStartYmd}`
    : pblancNo
      ? `pblanc-${stableIdPart(pblancNo)}-${receiptStartYmd}`
      : `notice-${stableIdPart(houseName)}-${normalizeYmd(raw.RCRIT_PBLANC_DE) ?? receiptStartYmd}-${receiptStartYmd}`;
  return { id, legacyIds: legacyId ? [legacyId] : undefined, manageNo, pblancNo };
}

function positiveNumber(value: unknown): number | undefined {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return undefined;
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
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
  const json = JSON.parse(body) as ApiPage;
  if (!Array.isArray(json.data)) throw new Error(json.error || "청약홈 API 응답 형식이 올바르지 않습니다.");
  return json;
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

function resolveType(raw: RawItem): "무순위" | "잔여세대" | "불법행위 재공급" {
  if (raw.HOUSE_SECD === "06") return "불법행위 재공급";
  const name = `${raw.HOUSE_SECD_NM ?? ""}${raw.HOUSE_NM ?? ""}`;
  if (name.includes("잔여")) return "잔여세대";
  return "무순위";
}

function modelKey(raw: RawItem): string {
  return `${raw.HOUSE_MANAGE_NO ?? ""}-${raw.PBLANC_NO ?? ""}`;
}

function normalizeModels(items: RawItem[]) {
  return items.map((raw) => ({
    modelNo: text(raw.MODEL_NO),
    houseType: text(raw.HOUSE_TY),
    supplyArea: text(raw.SUPLY_AR),
    supplyCount: nonNegativeNumber(raw.SUPLY_HSHLDCO),
    specialSupplyCount: nonNegativeNumber(raw.SPSPLY_HSHLDCO),
    specialSupply: {
      multiChild: nonNegativeNumber(raw.MNYCH_HSHLDCO),
      newlywed: nonNegativeNumber(raw.NWWDS_HSHLDCO),
      firstLife: nonNegativeNumber(raw.LFE_FRST_HSHLDCO),
      oldParent: nonNegativeNumber(raw.OLD_PARNTS_SUPORT_HSHLDCO),
      institution: nonNegativeNumber(raw.INSTT_RECOMEND_HSHLDCO),
      other: nonNegativeNumber(raw.ETC_HSHLDCO),
      transferInstitution: nonNegativeNumber(raw.TRANSR_INSTT_ENFSN_HSHLDCO),
      youth: nonNegativeNumber(raw.YGMN_HSHLDCO),
      newborn: nonNegativeNumber(raw.NWBB_HSHLDCO),
    },
    priceMax: positiveNumber(raw.LTTOT_TOP_AMOUNT),
  }));
}

function event(
  kind: ApplicationEvent["kind"],
  label: string,
  startValue: unknown,
  endValue?: unknown,
  startTime = "09:00",
  endTime = "17:30",
  sourceField = "",
  regionScope: ApplicationEvent["regionScope"] = "not-applicable",
): ApplicationEvent | null {
  const start = normalizeYmd(startValue);
  if (!start) return null;
  const end = normalizeYmd(endValue) ?? start;
  return {
    kind,
    label,
    start: kstDateToUtcIso(start, startTime),
    end: kstDateToUtcIso(end, endTime),
    sourceField,
    regionScope,
    confirmed: true,
  };
}

function eventsFor(raw: RawItem, kind: SourceKind): ApplicationEvent[] {
  const candidates: Array<ApplicationEvent | null> = [
    event("announce", "모집공고", raw.RCRIT_PBLANC_DE, raw.RCRIT_PBLANC_DE, "00:00", "23:59", "RCRIT_PBLANC_DE"),
    kind === "remndr"
      ? event("no-priority", "무순위·잔여 접수", raw.SUBSCRPT_RCEPT_BGNDE, raw.SUBSCRPT_RCEPT_ENDDE, "09:00", "17:30", "SUBSCRPT_RCEPT_BGNDE", "all")
      : event("receipt", "전체 접수 기간", raw.RCEPT_BGNDE, raw.RCEPT_ENDDE, "09:00", "17:30", "RCEPT_BGNDE", "all"),
    kind === "apt" ? event("special", "특별공급", raw.SPSPLY_RCEPT_BGNDE, raw.SPSPLY_RCEPT_ENDDE, "09:00", "17:30", "SPSPLY_RCEPT_BGNDE", "all") : null,
    kind === "apt" ? event("rank1", "1순위 해당지역", raw.GNRL_RNK1_CRSPAREA_RCPTDE, raw.GNRL_RNK1_CRSPAREA_ENDDE, "09:00", "17:30", "GNRL_RNK1_CRSPAREA_RCPTDE", "local") : null,
    kind === "apt" ? event("rank1", "1순위 경기지역", raw.GNRL_RNK1_ETC_GG_RCPTDE, raw.GNRL_RNK1_ETC_GG_ENDDE, "09:00", "17:30", "GNRL_RNK1_ETC_GG_RCPTDE", "gyeonggi") : null,
    kind === "apt" ? event("rank1", "1순위 기타지역", raw.GNRL_RNK1_ETC_AREA_RCPTDE, raw.GNRL_RNK1_ETC_AREA_ENDDE, "09:00", "17:30", "GNRL_RNK1_ETC_AREA_RCPTDE", "other") : null,
    kind === "apt" ? event("rank2", "2순위 해당지역", raw.GNRL_RNK2_CRSPAREA_RCPTDE, raw.GNRL_RNK2_CRSPAREA_ENDDE, "09:00", "17:30", "GNRL_RNK2_CRSPAREA_RCPTDE", "local") : null,
    kind === "apt" ? event("rank2", "2순위 경기지역", raw.GNRL_RNK2_ETC_GG_RCPTDE, raw.GNRL_RNK2_ETC_GG_ENDDE, "09:00", "17:30", "GNRL_RNK2_ETC_GG_RCPTDE", "gyeonggi") : null,
    kind === "apt" ? event("rank2", "2순위 기타지역", raw.GNRL_RNK2_ETC_AREA_RCPTDE, raw.GNRL_RNK2_ETC_AREA_ENDDE, "09:00", "17:30", "GNRL_RNK2_ETC_AREA_RCPTDE", "other") : null,
    event("winner", "당첨자 발표", raw.PRZWNER_PRESNATN_DE, raw.PRZWNER_PRESNATN_DE, "00:00", "23:59", "PRZWNER_PRESNATN_DE"),
    event("contract", "계약", raw.CNTRCT_CNCLS_BGNDE, raw.CNTRCT_CNCLS_ENDDE, "09:00", "17:30", "CNTRCT_CNCLS_BGNDE"),
  ];
  const seen = new Set<string>();
  return candidates
    .filter((item): item is ApplicationEvent => item !== null)
    .filter((item) => {
      const key = `${item.kind}|${item.label}|${item.start}|${item.end ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
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

function normalize(raw: RawItem, models: RawItem[], verifiedAt: string, kind: SourceKind) {
  const houseName = text(raw.HOUSE_NM);
  const draftEvents = eventsFor(raw, kind);
  const events = draftEvents;
  const receiptEvents = events.filter((item) => ["receipt", "special", "rank1", "rank2", "no-priority"].includes(item.kind));
  if (!houseName || receiptEvents.length === 0) return null;

  const startEvent = receiptEvents.reduce((min, item) => Date.parse(item.start) < Date.parse(min.start) ? item : min);
  const endEvent = receiptEvents.reduce((max, item) => Date.parse(item.end ?? item.start) > Date.parse(max.end ?? max.start) ? item : max);
  const lifecycleEnd = events.reduce((max, item) => Math.max(max, Date.parse(item.end ?? item.start)), 0);
  if (lifecycleEnd < Date.now()) return null;
  const startYmd = normalizeYmd(kind === "remndr" ? raw.SUBSCRPT_RCEPT_BGNDE : raw.RCEPT_BGNDE)
    ?? normalizeYmd(raw.SPSPLY_RCEPT_BGNDE)
    ?? startEvent.start.slice(0, 10);

  const identity = noticeIdentity(raw, houseName, startYmd);
  const identifiedEvents = events.map((item, index) => ({
    ...item,
    id: `${identity.id}:${item.sourceField || `${item.kind}-${index}`}`,
    noticeId: identity.id,
  }));
  const profile = findComplexProfile(houseName, text(raw.HSSPLY_ADRES));
  const modelSummaries = normalizeModels(models);
  const prices = modelSummaries
    .map((model) => model.priceMax)
    .filter((price): price is number => typeof price === "number");

  return {
    id: identity.id,
    legacyIds: identity.legacyIds,
    manageNo: identity.manageNo || undefined,
    pblancNo: identity.pblancNo || undefined,
    type: kind === "apt" ? "일반공급" : resolveType(raw),
    officialTypeName: text(raw.HOUSE_SECD_NM),
    housingCategory: "아파트",
    sourceOperation: kind === "apt" ? APT_DETAIL_OPERATION : REMNDR_DETAIL_OPERATION,
    houseName,
    region: text(raw.SUBSCRPT_AREA_CODE_NM) || "전국",
    regionCode: text(raw.SUBSCRPT_AREA_CODE),
    zipCode: text(raw.HSSPLY_ZIP),
    address: text(raw.HSSPLY_ADRES),
    totalHouseholdCount: profile?.totalHouseholdCount,
    totalHouseholdSourceUrl: profile?.sourceUrl,
    totalHouseholdVerifiedAt: profile?.verifiedAt,
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
    modelDataStatus: modelSummaries.length > 0 ? "collected" : "not-collected",
    modelDataVerifiedAt: modelSummaries.length > 0 ? verifiedAt : undefined,
    events: identifiedEvents,
    lastVerifiedAt: verifiedAt,
  };
}

function supabaseCredentials(): { url: string; serviceRole: string } | null {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && serviceRole ? { url, serviceRole } : null;
}

async function readModelCache(): Promise<Map<string, ModelCacheRow>> {
  const credentials = supabaseCredentials();
  if (!credentials) return new Map();
  const res = await fetch(`${credentials.url}/rest/v1/notice_model_cache?select=notice_key,models,fetched_at,retry_after&limit=1000`, {
    headers: { apikey: credentials.serviceRole, authorization: `Bearer ${credentials.serviceRole}` },
  });
  if (!res.ok) throw new Error(`주택형 캐시 조회 실패 ${res.status}`);
  const rows = await res.json() as ModelCacheRow[];
  return new Map(rows.map((row) => [row.notice_key, row]));
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

function relevantAptDetails(items: RawItem[]): RawItem[] {
  const now = Date.now();
  const date = new Date();
  const nextMonthEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 1) - 1;
  return items.filter((raw) => {
    const events = eventsFor(raw, "apt");
    if (events.length === 0) return false;
    const start = Math.min(...events.map((item) => Date.parse(item.start)));
    const end = Math.max(...events.map((item) => Date.parse(item.end ?? item.start)));
    return end >= now && start <= nextMonthEnd;
  });
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
        await writeModelCache({
          notice_key: key,
          models: [],
          fetched_at: new Date(0).toISOString(),
          retry_after: new Date(Date.now() + MODEL_RETRY_MS).toISOString(),
          last_error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
        }).catch(() => {});
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

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return new Response(cache.body, headers(200, {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "x-verified-at": cache.verifiedAt,
    }));
  }

  const serviceKey = serviceKeyParam();
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "청약홈 실공고 연결 키가 설정되지 않았습니다." }), headers(503));
  }

  try {
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
    const aptCache = await readModelCache().catch(() => new Map<string, ModelCacheRow>());
    const relevantApt = relevantAptDetails(aptDetails);
    const refreshTargets = relevantApt.filter((raw) => {
      const cached = aptCache.get(modelKey(raw));
      if (!cached) return true;
      if (cached.retry_after && Date.parse(cached.retry_after) > Date.now()) return false;
      return Date.now() - Date.parse(cached.fetched_at) >= MODEL_CACHE_TTL_MS;
    });
    if (refreshTargets.length > 0) runInBackground(refreshAptModelCache(serviceKey, refreshTargets));
    const notices = [
      ...remndrDetails.map((raw) => normalize(raw, remndrModelsByNotice.get(modelKey(raw)) ?? [], verifiedAt, "remndr")),
      ...aptDetails.map((raw) => normalize(raw, aptCache.get(modelKey(raw))?.models ?? [], verifiedAt, "apt")),
    ]
      .filter((notice) => notice !== null)
      .sort((a, b) => Date.parse(a.receiptStart) - Date.parse(b.receiptStart));

    const body = JSON.stringify(notices);
    cache = { at: Date.now(), body, verifiedAt };
    return new Response(body, headers(200, {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "x-verified-at": verifiedAt,
    }));
  } catch (err) {
    // stale-if-error: 업스트림 장애 시, TTL이 지난 마지막 성공 응답이 남아 있으면
    // 502 대신 그 복사본을 X-Data-Stale: 1 마커와 함께 서빙한다(응답 형태 동일).
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
