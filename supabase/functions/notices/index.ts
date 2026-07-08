// 청약홈 분양정보 API를 고객용 Notice JSON으로 정규화하는 Edge Function.
// 배포: supabase functions deploy notices --no-verify-jwt
// 환경변수: supabase secrets set DATA_GO_KR_SERVICE_KEY=...

const API_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
const DETAIL_OPERATION = "getRemndrLttotPblancDetail";
const MODEL_OPERATION = "getRemndrLttotPblancMdl";
const APPLY_HOME_URL = "https://www.applyhome.co.kr";
const CACHE_TTL_MS = 10 * 60 * 1000;
const PER_PAGE = 500;
const RECEIPT_NOTE =
  "청약홈 신청 가능 시간은 영업일 09:00~17:30 기준입니다. 공고별 정정·별도 조건은 모집공고 원문을 확인하세요.";

type RawItem = Record<string, unknown>;
type ApiPage = { data?: RawItem[]; totalCount?: number; currentCount?: number; error?: string };

let cache: { at: number; body: string } | null = null;

function headers(status = 200): ResponseInit {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  };
}

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function kstDateToUtcIso(dateYmd: string, timeHm: string): string {
  return new Date(`${dateYmd}T${timeHm}:00+09:00`).toISOString();
}

function text(value: unknown): string | undefined {
  const out = String(value ?? "").trim();
  return out || undefined;
}

function urlText(value: unknown): string | undefined {
  const out = text(value);
  if (!out) return undefined;
  if (/^https?:\/\//i.test(out)) return out;
  if (/^www\./i.test(out)) return `https://${out}`;
  return out;
}

function positiveNumber(value: unknown): number | undefined {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : undefined;
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

async function fetchApiPage(operation: string, serviceKey: string, page: number): Promise<ApiPage> {
  const url = new URL(`${API_BASE}/${operation}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(PER_PAGE));
  url.searchParams.set("returnType", "JSON");
  url.searchParams.set("serviceKey", serviceKey);
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`청약홈 API ${res.status}: ${body.slice(0, 180)}`);
  const json = JSON.parse(body) as ApiPage;
  if (!Array.isArray(json.data)) throw new Error(json.error || "청약홈 API 응답 형식이 올바르지 않습니다.");
  return json;
}

async function fetchAll(operation: string, serviceKey: string): Promise<RawItem[]> {
  const first = await fetchApiPage(operation, serviceKey, 1);
  const total = first.totalCount ?? first.data?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => fetchApiPage(operation, serviceKey, i + 2)),
  );
  return [first, ...rest].flatMap((page) => page.data ?? []);
}

function resolveType(raw: RawItem): "무순위" | "잔여세대" | "취소후재공급" {
  if (raw.HOUSE_SECD === "06") return "취소후재공급";
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
    supplyCount: positiveNumber(raw.SUPLY_HSHLDCO),
    specialSupplyCount: positiveNumber(raw.SPSPLY_HSHLDCO),
    priceMax: positiveNumber(raw.LTTOT_TOP_AMOUNT),
  }));
}

function normalize(raw: RawItem, models: RawItem[], verifiedAt: string) {
  const houseName = text(raw.HOUSE_NM);
  const start = text(raw.SUBSCRPT_RCEPT_BGNDE);
  const end = text(raw.SUBSCRPT_RCEPT_ENDDE);
  if (!houseName || !start || !end) return null;
  if (end < todayKst()) return null;

  const manageNo = String(raw.HOUSE_MANAGE_NO ?? "");
  const pblancNo = String(raw.PBLANC_NO ?? "");
  const modelSummaries = normalizeModels(models);
  const prices = modelSummaries
    .map((model) => model.priceMax)
    .filter((price): price is number => typeof price === "number");

  return {
    id: `${manageNo}-${pblancNo}` || houseName,
    manageNo,
    pblancNo,
    type: resolveType(raw),
    officialTypeName: text(raw.HOUSE_SECD_NM),
    housingCategory: "APT 잔여세대/무순위",
    sourceOperation: DETAIL_OPERATION,
    houseName,
    region: text(raw.SUBSCRPT_AREA_CODE_NM) || "전국",
    regionCode: text(raw.SUBSCRPT_AREA_CODE),
    zipCode: text(raw.HSSPLY_ZIP),
    address: text(raw.HSSPLY_ADRES),
    supplyCount: positiveNumber(raw.TOT_SUPLY_HSHLDCO),
    priceMin: prices.length > 0 ? Math.min(...prices) : undefined,
    priceMax: prices.length > 0 ? Math.max(...prices) : undefined,
    announceDate: text(raw.RCRIT_PBLANC_DE),
    receiptStart: kstDateToUtcIso(start, "09:00"),
    receiptEnd: kstDateToUtcIso(end, "17:30"),
    winnerDate: text(raw.PRZWNER_PRESNATN_DE),
    contractStartDate: text(raw.CNTRCT_CNCLS_BGNDE),
    contractEndDate: text(raw.CNTRCT_CNCLS_ENDDE),
    officialHomepageUrl: urlText(raw.HMPG_ADRES),
    businessOwnerName: text(raw.BSNS_MBY_NM),
    contactPhone: text(raw.MDHS_TELNO),
    moveInMonth: text(raw.MVN_PREARNGE_YM),
    newspaperName: text(raw.NSPRC_NM),
    applyHomeUrl: APPLY_HOME_URL,
    noticeUrl: urlText(raw.PBLANC_URL),
    receiptNote: RECEIPT_NOTE,
    modelSummaries: modelSummaries.length > 0 ? modelSummaries : undefined,
    lastVerifiedAt: verifiedAt,
  };
}

Deno.serve(async () => {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return new Response(cache.body, headers());
  }

  const serviceKey = serviceKeyParam();
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "청약홈 실공고 연결 키가 설정되지 않았습니다." }), headers(503));
  }

  try {
    const [details, modelItems] = await Promise.all([
      fetchAll(DETAIL_OPERATION, serviceKey),
      fetchAll(MODEL_OPERATION, serviceKey),
    ]);
    const modelsByNotice = new Map<string, RawItem[]>();
    for (const item of modelItems) {
      const key = modelKey(item);
      modelsByNotice.set(key, [...(modelsByNotice.get(key) ?? []), item]);
    }

    const verifiedAt = new Date().toISOString();
    const notices = details
      .map((raw) => normalize(raw, modelsByNotice.get(modelKey(raw)) ?? [], verifiedAt))
      .filter((notice) => notice !== null)
      .sort((a, b) => Date.parse(a.receiptStart) - Date.parse(b.receiptStart));

    const body = JSON.stringify(notices);
    cache = { at: Date.now(), body };
    return new Response(body, headers());
  } catch (err) {
    const message = err instanceof Error ? err.message : "청약홈 공고를 불러오지 못했습니다.";
    return new Response(JSON.stringify({ error: message }), headers(502));
  }
});
