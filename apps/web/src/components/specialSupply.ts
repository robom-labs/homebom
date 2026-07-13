// 특별공급 세부 유형을 공식 필드 순서대로 화면에 제공한다.
import type { NoticeModelSummary } from "@zoopzoopcall/core";

export const SPECIAL_SUPPLY_FIELDS = [
  ["institution", "기관추천"],
  ["multiChild", "다자녀"],
  ["newlywed", "신혼부부"],
  ["firstLife", "생애최초"],
  ["oldParent", "노부모부양"],
  ["transferInstitution", "이전기관"],
  ["other", "기타"],
  ["youth", "청년"],
  ["newborn", "신생아"],
] as const;

export function specialSupplyEntries(model: NoticeModelSummary) {
  return SPECIAL_SUPPLY_FIELDS.flatMap(([key, label]) => {
    const count = model.specialSupply?.[key];
    return count == null ? [] : [{ key, label, count }];
  });
}

export function specialSupplySummary(models: NoticeModelSummary[]): string | null {
  const totals = SPECIAL_SUPPLY_FIELDS.map(([key, label]) => ({
    key,
    label,
    count: models.reduce((sum, model) => sum + (model.specialSupply?.[key] ?? 0), 0),
    reported: models.some((model) => model.specialSupply?.[key] != null),
  })).filter((item) => item.reported && item.count > 0);
  if (totals.length === 0) return null;
  const visible = totals.slice(0, 3).map((item) => `${item.label} ${item.count}`).join(" · ");
  return totals.length > 3 ? `${visible} · 외 ${totals.length - 3}유형` : visible;
}
