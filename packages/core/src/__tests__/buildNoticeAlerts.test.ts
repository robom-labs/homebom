// 알림 시각 계산 순수함수 테스트. 결과 형태를 골든마스터로 잠근다.
import { describe, expect, it } from "vitest";
import {
  buildNoticeAlerts,
  DEFAULT_CLOSE_OFFSETS,
  DEFAULT_OPEN_OFFSETS,
  offsetLabel,
} from "../alarm/buildNoticeAlerts";
import type { Notice } from "../notice/types";

const notice: Notice = {
  id: "2026000001-01",
  type: "무순위",
  houseName: "한강뷰 센트럴",
  region: "서울",
  receiptStart: "2026-07-10T00:00:00.000Z", // KST 7/10 09:00
  receiptEnd: "2026-07-10T08:30:00.000Z", // KST 7/10 17:30
  applyHomeUrl: "https://www.applyhome.co.kr",
  lastVerifiedAt: "2026-07-01T00:00:00.000Z",
};

const T = (iso: string) => Date.parse(iso);

describe("offsetLabel", () => {
  it("정각·분·시간·일을 구분한다", () => {
    expect(offsetLabel(0)).toBe("정각");
    expect(offsetLabel(30)).toBe("30분");
    expect(offsetLabel(180)).toBe("3시간");
    expect(offsetLabel(1440)).toBe("1일");
  });
});

describe("buildNoticeAlerts", () => {
  it("충분히 이른 시점에는 프리셋 전부를 예약한다", () => {
    const now = T("2026-07-01T00:00:00Z");
    const open = buildNoticeAlerts(notice, "open", DEFAULT_OPEN_OFFSETS, now);
    const close = buildNoticeAlerts(notice, "close", DEFAULT_CLOSE_OFFSETS, now);
    expect(open).toHaveLength(3);
    expect(close).toHaveLength(3);
  });

  it("과거 시각은 예약하지 않는다", () => {
    // 접수 시작 2시간 전: 1일 전·3시간 전은 이미 지났고 정각만 남는다.
    const now = T("2026-07-09T22:00:00Z");
    const open = buildNoticeAlerts(notice, "open", DEFAULT_OPEN_OFFSETS, now);
    expect(open.map((a) => a.offsetMinutes)).toEqual([0]);
  });

  it("fireAt이 now와 같으면 제외한다 (경계)", () => {
    const now = T("2026-07-10T00:00:00Z");
    const open = buildNoticeAlerts(notice, "open", [0], now);
    expect(open).toHaveLength(0);
  });

  it("알림 ID는 결정적이다", () => {
    const now = T("2026-07-01T00:00:00Z");
    const [a] = buildNoticeAlerts(notice, "close", [60], now);
    expect(a.id).toBe("2026000001-01:close:60");
  });

  it("골든마스터: 시작·마감 알림의 제목/본문/시각", () => {
    const now = T("2026-07-01T00:00:00Z");
    const open = buildNoticeAlerts(notice, "open", DEFAULT_OPEN_OFFSETS, now);
    const close = buildNoticeAlerts(notice, "close", DEFAULT_CLOSE_OFFSETS, now);
    expect(
      [...open, ...close].map((a) => ({
        id: a.id,
        fireAt: new Date(a.fireAt).toISOString(),
        title: a.title,
        body: a.body,
      })),
    ).toMatchSnapshot();
  });
});
