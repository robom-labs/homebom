// 운영 공고 API의 공개 계약·최신성·수집 통계를 독립 감시한다.
import { assessNoticesHealth } from "./notices-health-core.mjs";

const url = process.env.VITE_NOTICES_URL || process.argv[2];
if (!url) throw new Error("VITE_NOTICES_URL이 필요합니다.");

const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw new Error(`공개 API HTTP ${response.status}`);
const data = await response.json();
const minimumUpcoming14Days = Number(process.env.MIN_UPCOMING_14_DAYS ?? 0);
const result = assessNoticesHealth({
  data,
  headers: response.headers,
  minimumUpcoming14Days: Number.isFinite(minimumUpcoming14Days)
    ? Math.max(0, Math.trunc(minimumUpcoming14Days))
    : 0,
});
if (!result.ok) throw new Error(result.errors.join("\n"));
console.log(JSON.stringify({ status: "ok", ...result.metrics }));
