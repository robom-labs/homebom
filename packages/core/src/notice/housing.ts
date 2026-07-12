// 주택 형태·주택형·세대수 정보를 화면용 문구로 정리하는 순수함수다.

const REMAINDER_APT_OPERATION = "getRemndrLttotPblancDetail";

function positiveCount(value?: number): number | undefined {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : undefined;
}

export function inferHousingCategory(
  housingCategory?: string,
  sourceOperation?: string,
): string {
  const category = housingCategory?.trim();
  if (category) return category;
  if (sourceOperation === REMAINDER_APT_OPERATION) return "아파트";
  return "주택 형태 확인";
}

export function formatHouseTypeLabel(value?: string | number | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.endsWith("형")) return raw;

  const match = raw.match(/^0*(\d+)(?:\.(\d+))?([A-Za-z]*)$/);
  if (!match) return `${raw}형`;
  const fraction = match[2]?.replace(/0+$/, "");
  return `${Number(match[1])}${fraction ? `.${fraction}` : ""}${match[3]}형`;
}

export function formatHouseholdSummary(
  totalHouseholdCount?: number,
  supplyCount?: number,
): string {
  const total = positiveCount(totalHouseholdCount);
  const supply = positiveCount(supplyCount);
  const number = (value: number) => value.toLocaleString("ko-KR");

  if (total && supply) return `총 ${number(total)}세대 중 이번 모집 ${number(supply)}세대`;
  if (total) return `단지 전체 ${number(total)}세대`;
  if (supply) return `총 세대수 공고문 확인 · 이번 모집 ${number(supply)}세대`;
  return "전체·모집 세대수 공고문 확인";
}
