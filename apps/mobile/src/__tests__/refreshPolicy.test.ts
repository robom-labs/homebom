// 네이티브 전면 복귀 자동 갱신의 10분 경계값을 검증한다.
import { describe, expect, it } from "vitest";
import { FOREGROUND_REFRESH_AFTER_MS, shouldRefreshOnForeground } from "../domain/refreshPolicy";

describe("shouldRefreshOnForeground", () => {
  it("10분 전에는 재요청하지 않고 10분부터 재요청한다", () => {
    const loadedAt = 1_000_000;
    expect(shouldRefreshOnForeground(loadedAt, loadedAt + FOREGROUND_REFRESH_AFTER_MS - 1)).toBe(false);
    expect(shouldRefreshOnForeground(loadedAt, loadedAt + FOREGROUND_REFRESH_AFTER_MS)).toBe(true);
  });
});
