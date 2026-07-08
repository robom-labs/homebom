// KST 표기·D-day·남은 시간 계산 테스트.
import { describe, expect, it } from "vitest";
import { ddayKst, formatKstDateTime, formatManwon, formatRemaining, kstDateKey } from "../time/kst";

const T = (iso: string) => Date.parse(iso);

describe("kstDateKey", () => {
  it("UTC 14:59는 KST 같은 날 23:59", () => {
    expect(kstDateKey(T("2026-07-01T14:59:00Z"))).toBe("2026-07-01");
  });

  it("UTC 15:00은 KST 다음 날 00:00", () => {
    expect(kstDateKey(T("2026-07-01T15:00:00Z"))).toBe("2026-07-02");
  });
});

describe("ddayKst", () => {
  it("같은 KST 날짜면 0", () => {
    expect(ddayKst("2026-07-10T00:00:00+09:00", T("2026-07-10T23:00:00+09:00"))).toBe(0);
  });

  it("KST 자정 경계를 넘으면 1", () => {
    // now: KST 7/9 23:59, target: KST 7/10 00:00 → 달력상 내일.
    expect(ddayKst("2026-07-10T00:00:00+09:00", T("2026-07-09T23:59:00+09:00"))).toBe(1);
  });

  it("지난 날짜면 음수", () => {
    expect(ddayKst("2026-07-08T09:00:00+09:00", T("2026-07-10T09:00:00+09:00"))).toBe(-2);
  });
});

describe("formatKstDateTime", () => {
  it("KST 기준 월·일·요일·시각으로 표기한다", () => {
    const s = formatKstDateTime("2026-07-10T00:00:00.000Z"); // KST 7/10 09:00 (금)
    expect(s).toContain("7월 10일");
    expect(s).toContain("금");
    expect(s).toContain("09:00");
  });
});

describe("formatRemaining", () => {
  it("0 이하는 종료", () => {
    expect(formatRemaining(0)).toBe("종료");
    expect(formatRemaining(-5000)).toBe("종료");
  });

  it("일 단위", () => {
    expect(formatRemaining(2 * 86400_000 + 3 * 3600_000)).toBe("2일 3시간");
    expect(formatRemaining(86400_000)).toBe("1일");
  });

  it("시간 단위", () => {
    expect(formatRemaining(3 * 3600_000 + 15 * 60_000)).toBe("3시간 15분");
  });

  it("분 단위 (withSeconds 옵션)", () => {
    expect(formatRemaining(5 * 60_000 + 30_000)).toBe("5분");
    expect(formatRemaining(5 * 60_000 + 30_000, true)).toBe("5분 30초");
  });

  it("초 단위", () => {
    expect(formatRemaining(42_000)).toBe("42초");
  });
});

describe("formatManwon", () => {
  it("억+만원 조합", () => {
    expect(formatManwon(48500)).toBe("4억 8,500만원");
  });

  it("정확히 억 단위", () => {
    expect(formatManwon(50000)).toBe("5억원");
  });

  it("억 미만", () => {
    expect(formatManwon(9800)).toBe("9,800만원");
  });
});
