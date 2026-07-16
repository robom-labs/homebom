// 개인정보 최소 분석 adapter가 동의 전 noop이며 전송 실패를 격리하는지 검증한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyticsConsentGranted,
  setAnalyticsConsent,
  trackFamilyEvent,
} from "../familyAnalytics";
import { version as appVersion } from "../../../package.json";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

describe("family analytics", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0" });
    vi.stubGlobal("crypto", { randomUUID: () => "anonymous-test-id" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://analytics.example.test/events");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("동의 전에는 네트워크 요청을 보내지 않는다", async () => {
    expect(analyticsConsentGranted()).toBe(false);
    await trackFamilyEvent("notice_opened", "notice-detail");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("HTTPS endpoint와 동의가 있을 때 계약 필드만 보낸다", async () => {
    expect(setAnalyticsConsent(true)).toBe(true);
    await trackFamilyEvent("notice_opened", "notice-detail");

    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({
      event_name: "notice_opened",
      app_id: "homebom",
      app_version: appVersion,
      platform: "web",
      surface: "notice-detail",
      session_kind: "guest",
      anonymous_id: "anonymous-test-id",
      campaign: "",
      family_spec_version: "1.0.0",
    });
    expect(Object.keys(payload).sort()).toEqual([
      "anonymous_id",
      "app_id",
      "app_version",
      "campaign",
      "event_name",
      "family_spec_version",
      "platform",
      "session_kind",
      "surface",
      "timestamp",
    ]);
  });

  it("endpoint가 없거나 전송이 실패해도 예외를 전파하지 않는다", async () => {
    setAnalyticsConsent(true);
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "");
    await expect(trackFamilyEvent("alert_enabled", "notice-detail")).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();

    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://analytics.example.test/events");
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await expect(trackFamilyEvent("alert_enabled", "notice-detail")).resolves.toBeUndefined();
  });
});
