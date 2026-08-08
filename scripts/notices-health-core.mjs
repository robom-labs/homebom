// 청약봄 공개 API의 최신성·중복·날짜·수집 통계를 독립적으로 판정한다.
const DEFAULT_MAX_AGE_MS = 150 * 60 * 1000;
const REQUIRED_SOURCE_OPERATIONS = [
  "getAPTLttotPblancDetail",
  "getOPTLttotPblancDetail",
  "getRemndrLttotPblancDetail",
  "getPblPvtRentLttotPblancDetail",
  "getUrbtyOfctlLttotPblancDetail",
];

function headerValue(headers, name) {
  if (headers instanceof Headers) return headers.get(name);
  if (!headers || typeof headers !== "object") return null;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match ? String(match[1]) : null;
}

function parseCollectionStats(headers, errors) {
  const raw = headerValue(headers, "x-collection-stats");
  if (!raw) {
    errors.push("x-collection-stats 헤더가 없습니다.");
    return null;
  }
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value;
  } catch {
    errors.push("x-collection-stats 헤더가 올바른 JSON이 아닙니다.");
    return null;
  }
}

export function assessNoticesHealth({
  data,
  headers = {},
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  minimumUpcoming14Days = 0,
} = {}) {
  const errors = [];
  const notices = Array.isArray(data) ? data : [];
  if (!Array.isArray(data)) errors.push("공개 API 응답이 배열이 아닙니다.");
  if (notices.length === 0) errors.push("게시된 활성 공고가 0건입니다.");

  const ids = new Set();
  let upcoming14Days = 0;
  const futureCutoff = now + 14 * 24 * 60 * 60 * 1000;
  for (const [index, notice] of notices.entries()) {
    if (!notice || typeof notice !== "object" || Array.isArray(notice)) {
      errors.push(`${index + 1}번째 공고가 객체가 아닙니다.`);
      continue;
    }
    const id = typeof notice.id === "string" ? notice.id.trim() : "";
    if (!id) errors.push(`${index + 1}번째 공고의 id가 없습니다.`);
    else if (ids.has(id)) errors.push(`중복 공고 id가 있습니다: ${id}`);
    else ids.add(id);
    if (typeof notice.houseName !== "string" || !notice.houseName.trim()) {
      errors.push(`${id || index + 1} 공고명이 없습니다.`);
    }
    const start = Date.parse(notice.receiptStart ?? "");
    const end = Date.parse(notice.receiptEnd ?? "");
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      errors.push(`${id || index + 1} 접수 날짜가 올바르지 않습니다.`);
      continue;
    }
    if (start > end) errors.push(`${id || index + 1} 접수 시작일이 마감일보다 늦습니다.`);
    if (end < now) errors.push(`${id || index + 1} 이미 마감된 공고가 활성 피드에 있습니다.`);
    if (notice.cancelled === true) errors.push(`${id || index + 1} 취소 공고가 활성 피드에 있습니다.`);
    if (start > now && start <= futureCutoff) upcoming14Days += 1;
    if (!Number.isFinite(Date.parse(notice.lastVerifiedAt ?? ""))) {
      errors.push(`${id || index + 1} 마지막 검증 시각이 없습니다.`);
    }
  }
  if (upcoming14Days < minimumUpcoming14Days) {
    errors.push(
      `앞으로 14일 안에 접수를 시작하는 공고가 ${upcoming14Days}건으로 감시 기준 ${minimumUpcoming14Days}건보다 적습니다.`,
    );
  }

  const stale = headerValue(headers, "x-data-stale") === "1";
  if (stale) errors.push("API가 마지막 정상본(stale)을 제공 중입니다.");
  const verifiedAt = headerValue(headers, "x-verified-at");
  const verifiedMs = Date.parse(verifiedAt ?? "");
  if (!Number.isFinite(verifiedMs)) {
    errors.push("x-verified-at 최신성 헤더가 없습니다.");
  } else {
    const age = now - verifiedMs;
    if (age < -5 * 60 * 1000) errors.push("검증 시각이 현재보다 5분 이상 미래입니다.");
    if (age > maxAgeMs) errors.push(`공식 자료 확인이 ${Math.round(age / 60_000)}분 동안 갱신되지 않았습니다.`);
  }

  const stats = parseCollectionStats(headers, errors);
  let sourceActive = null;
  if (stats) {
    const published = Number(stats.published);
    const valid = Number(stats.valid);
    const fetched = Number(stats.fetched);
    sourceActive = Object.values(stats.sources ?? {}).reduce(
      (sum, source) => sum + (Number(source?.active) || 0),
      0,
    );
    if (published !== notices.length) errors.push(`수집 통계 published ${published}건과 응답 ${notices.length}건이 다릅니다.`);
    if (!Number.isFinite(valid) || valid < published) errors.push("수집 통계 valid가 published보다 작습니다.");
    if (!Number.isFinite(fetched) || fetched < valid) errors.push("수집 통계 fetched가 valid보다 작습니다.");
    if (sourceActive !== published) errors.push(`출처별 활성 합계 ${sourceActive}건과 published ${published}건이 다릅니다.`);
    for (const operation of REQUIRED_SOURCE_OPERATIONS) {
      const source = stats.sources?.[operation];
      if (!source || !Number.isFinite(Number(source.fetched)) || Number(source.fetched) < 1) {
        errors.push(`필수 청약홈 자료 유형이 수집되지 않았습니다: ${operation}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    metrics: {
      notices: notices.length,
      uniqueIds: ids.size,
      upcoming14Days,
      stale,
      verifiedAt: verifiedAt ?? null,
      sourceActive,
    },
  };
}
