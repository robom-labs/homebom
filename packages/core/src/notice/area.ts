// 공급면적(㎡)을 고객용 문자열로 포맷하는 순수함수. ㎡와 평을 함께 보여준다.

/** 1평 = 3.305785㎡ (한국 부동산 관행 상수). */
export const SQM_PER_PYEONG = 3.305785;

/** ㎡ 값을 평으로 환산한다(반올림 없이 원시값). */
export function pyeongFromSqm(sqm: number): number {
  return sqm / SQM_PER_PYEONG;
}

/**
 * 공급면적을 "84.98㎡ · 25.7평"으로 포맷한다.
 * 청약홈 원문과 맞추려고 ㎡를 먼저, 평은 보조로 둔다(소수 둘째/첫째 자리).
 * 값이 없거나 숫자로 해석되지 않으면 null(호출부에서 "면적 확인" 등으로 처리).
 */
export function formatArea(supplyArea?: string | number | null): string | null {
  if (supplyArea == null) return null;
  const sqm = typeof supplyArea === "number" ? supplyArea : Number.parseFloat(String(supplyArea));
  if (!Number.isFinite(sqm) || sqm <= 0) return null;
  const sqmText = trimZeros(sqm.toFixed(2));
  const pyeongText = trimZeros(pyeongFromSqm(sqm).toFixed(1));
  return `${sqmText}㎡ · ${pyeongText}평`;
}

/** "84.90" → "84.9", "60.00" → "60"처럼 뒤따르는 0을 정리한다. */
function trimZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}
