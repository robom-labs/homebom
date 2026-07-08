// 청약홈 분양정보 API 프록시 Edge Function. 서비스키를 서버에만 두고 Notice[]를 반환한다.
// 배포: supabase functions deploy notices --no-verify-jwt
// 환경변수: supabase secrets set DATA_GO_KR_SERVICE_KEY=...
//
// 실측 스펙(공공데이터포털 15098547, 스웨거 stages/37000 확인):
//   GET https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancDetail
//   파라미터: page, perPage, returnType=JSON, serviceKey
//   HOUSE_SECD: 04=무순위, 06=불법행위 재공급(취소후재공급)

const API_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
const OPERATION = "getRemndrLttotPblancDetail";
const CACHE_TTL_MS = 10 * 60 * 1000; // 일일 호출 한도 보호용 10분 캐시.

type RawItem = Record<string, unknown>;

let cache: { at: number; body: string } | null = null;

function kstDateToUtcIso(dateYmd: string, timeHm: string): string {
  return new Date(`${dateYmd}T${timeHm}:00+09:00`).toISOString();
}

function normalize(raw: RawItem, verifiedAt: string) {
  const houseName = String(raw.HOUSE_NM ?? "").trim();
  const start = raw.SUBSCRPT_RCEPT_BGNDE as string | undefined;
  const end = raw.SUBSCRPT_RCEPT_ENDDE as string | undefined;
  if (!houseName || !start || !end) return null;
  const secdName = String(raw.HOUSE_SECD_NM ?? "");
  const type =
    raw.HOUSE_SECD === "06"
      ? "취소후재공급"
      : secdName.includes("잔여")
        ? "잔여세대"
        : "무순위";
  const supply = Number(raw.TOT_SUPLY_HSHLDCO);
  return {
    id: `${raw.HOUSE_MANAGE_NO ?? ""}-${raw.PBLANC_NO ?? ""}`,
    type,
    houseName,
    region: String(raw.SUBSCRPT_AREA_CODE_NM ?? "").trim() || "전국",
    address: String(raw.HSSPLY_ADRES ?? "").trim() || undefined,
    supplyCount: Number.isFinite(supply) && supply > 0 ? supply : undefined,
    announceDate: raw.RCRIT_PBLANC_DE,
    receiptStart: kstDateToUtcIso(start, "09:00"),
    receiptEnd: kstDateToUtcIso(end, "17:30"),
    winnerDate: raw.PRZWNER_PRESNATN_DE,
    applyHomeUrl: String(raw.PBLANC_URL ?? "").trim() || "https://www.applyhome.co.kr",
    lastVerifiedAt: verifiedAt,
  };
}

Deno.serve(async () => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  };

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return new Response(cache.body, { headers });
  }

  const serviceKey = Deno.env.get("DATA_GO_KR_SERVICE_KEY");
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: "DATA_GO_KR_SERVICE_KEY 미설정" }), {
      status: 500,
      headers,
    });
  }

  const url = new URL(`${API_BASE}/${OPERATION}`);
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", "300");
  url.searchParams.set("returnType", "JSON");
  url.searchParams.set("serviceKey", serviceKey);

  const res = await fetch(url);
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `청약홈 API ${res.status}` }), {
      status: 502,
      headers,
    });
  }

  const json = (await res.json()) as { data?: RawItem[] };
  const verifiedAt = new Date().toISOString();
  const notices = (json.data ?? [])
    .map((raw) => normalize(raw, verifiedAt))
    .filter((n) => n !== null);

  const body = JSON.stringify(notices);
  cache = { at: Date.now(), body };
  return new Response(body, { headers });
});
