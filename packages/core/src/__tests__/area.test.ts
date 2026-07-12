// 면적 포맷 순수함수 테스트. ㎡→평 환산과 폴백 경계를 잠근다.
import { describe, expect, it } from "vitest";
import { formatArea, pyeongFromSqm, SQM_PER_PYEONG } from "../notice/area";

describe("formatArea", () => {
  it("㎡를 먼저, 평을 보조로 소수 첫째 자리로 포맷한다", () => {
    expect(formatArea("84.9752")).toBe("84.98㎡ · 25.7평");
    expect(formatArea("59.94")).toBe("59.94㎡ · 18.1평");
  });

  it("정수·소수 뒤 0은 정리한다", () => {
    expect(formatArea("60")).toBe("60㎡ · 18.2평");
    expect(formatArea("84.90")).toBe("84.9㎡ · 25.7평");
  });

  it("숫자 타입도 처리한다", () => {
    expect(formatArea(49.5)).toBe("49.5㎡ · 15평");
  });

  it("값이 없거나 0·비숫자·공백이면 null을 반환한다", () => {
    expect(formatArea(undefined)).toBeNull();
    expect(formatArea(null)).toBeNull();
    expect(formatArea("0")).toBeNull();
    expect(formatArea("면적미상")).toBeNull();
    expect(formatArea("   ")).toBeNull();
  });
});

describe("pyeongFromSqm", () => {
  it("3.305785㎡를 1평으로 환산한다", () => {
    expect(pyeongFromSqm(SQM_PER_PYEONG)).toBeCloseTo(1, 5);
    expect(pyeongFromSqm(84.9752)).toBeCloseTo(25.705, 2);
  });
});
