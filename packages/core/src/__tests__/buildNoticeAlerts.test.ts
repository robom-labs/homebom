// 알림 시각 계산 순수함수 테스트. 결과 형태를 골든마스터로 잠근다.
import { describe, expect, it } from "vitest";
import {
  buildNoticeAlerts,
  buildEventAlerts,
  latestNoticeAlertDate,
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
  events: [{
    kind: "no-priority",
    label: "무순위 접수",
    start: "2026-07-10T00:00:00.000Z",
    end: "2026-07-10T08:30:00.000Z",
    timeSource: "official",
    startTimeConfirmed: true,
    endTimeConfirmed: true,
    confirmed: true,
  }],
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

describe("buildEventAlerts", () => {
  it("선택한 세부 일정에 하루 전·한 시간 전 안정 ID 알림을 만든다", () => {
    const events = [{
      id: `${notice.id}:SPSPLY_RCEPT_BGNDE`,
      noticeId: notice.id,
      kind: "special" as const,
      label: "특별공급",
      start: "2026-07-10T00:00:00.000Z",
      startTimeConfirmed: true,
      sourceField: "SPSPLY_RCEPT_BGNDE",
    }];
    const alerts = buildEventAlerts(notice, events, T("2026-07-01T00:00:00Z"));
    expect(alerts.map((item) => item.id)).toEqual([
      `${notice.id}:SPSPLY_RCEPT_BGNDE:event:1440`,
      `${notice.id}:SPSPLY_RCEPT_BGNDE:event:60`,
    ]);
    expect(alerts.every((item) => item.kind === "event")).toBe(true);
  });

  it("접수 마감 이후인 발표·계약 리마인더도 예약한다 (receiptEnd로 막지 않는다)", () => {
    // receiptEnd(7/10)는 이미 지났지만 발표일은 8/5로 미래다.
    const now = T("2026-07-20T00:00:00Z");
    const winner = [{
      id: `${notice.id}:PRZWNER_PRESNATN_DE`,
      noticeId: notice.id,
      kind: "winner" as const,
      label: "당첨자 발표",
      start: "2026-08-05T00:00:00.000Z", // KST 8/5
      end: "2026-08-05T00:00:00.000Z",
      timeSource: "date-only" as const,
      startTimeConfirmed: false,
      endTimeConfirmed: false,
      confirmed: false,
      sourceField: "PRZWNER_PRESNATN_DE",
    }];
    const alerts = buildEventAlerts(notice, winner, now);
    // 전일·당일 09:00 KST 리마인더 2건이 남아야 한다.
    expect(alerts.map((a) => a.id)).toEqual([
      `${notice.id}:PRZWNER_PRESNATN_DE:event:1440`,
      `${notice.id}:PRZWNER_PRESNATN_DE:event:0`,
    ]);
    expect(alerts.every((a) => a.fireAt > now)).toBe(true);
  });
});

describe("latestNoticeAlertDate", () => {
  it("발표·계약을 포함한 가장 늦은 관련 날짜를 반환한다", () => {
    const withDates: Notice = { ...notice, winnerDate: "2026-08-05", contractEndDate: "2026-08-20" };
    expect(latestNoticeAlertDate(withDates)).toBe(Date.parse("2026-08-20"));
    // 마감(7/10)보다 발표(8/5)가 늦으면 발표일을 반환한다.
    expect(latestNoticeAlertDate({ ...notice, winnerDate: "2026-08-05" })).toBe(Date.parse("2026-08-05"));
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

  it("날짜만 아는 공고는 확정 시각 기준 접수 시작/마감 알림을 예약하지 않는다 (가짜 시각 금지)", () => {
    const dateOnly = { ...notice, events: notice.events?.map((event) => ({ ...event, confirmed: false, startTimeConfirmed: false, endTimeConfirmed: false, timeSource: "date-only" as const })) };
    expect(buildNoticeAlerts(dateOnly, "open", DEFAULT_OPEN_OFFSETS, T("2026-07-01T00:00:00Z"))).toEqual([]);
    expect(buildNoticeAlerts(dateOnly, "close", DEFAULT_CLOSE_OFFSETS, T("2026-07-01T00:00:00Z"))).toEqual([]);
  });

  it("발표·계약처럼 날짜만 아는 세부 일정은 전일·당일 09:00 KST 리마인더를 만든다 (가짜 시각 미표기)", () => {
    const dateOnly: Notice = {
      ...notice,
      events: [{
        id: `${notice.id}:PRZWNER_PRESNATN_DE`,
        noticeId: notice.id,
        kind: "winner",
        label: "당첨자 발표",
        start: "2026-07-10T00:00:00.000Z", // KST 7/10
        end: "2026-07-10T00:00:00.000Z",
        timeSource: "date-only",
        startTimeConfirmed: false,
        endTimeConfirmed: false,
        confirmed: false,
        sourceField: "PRZWNER_PRESNATN_DE",
      }],
    };
    const alerts = buildEventAlerts(dateOnly, dateOnly.events ?? [], T("2026-07-01T00:00:00Z"));
    expect(alerts.map((a) => a.id)).toEqual([
      `${notice.id}:PRZWNER_PRESNATN_DE:event:1440`,
      `${notice.id}:PRZWNER_PRESNATN_DE:event:0`,
    ]);
    // 전일 09:00 KST, 당일 09:00 KST.
    expect(alerts.map((a) => new Date(a.fireAt).toISOString())).toEqual([
      "2026-07-09T00:00:00.000Z",
      "2026-07-10T00:00:00.000Z",
    ]);
    expect(alerts[1].title).toContain("오늘");
    // 제목·본문에 HH:mm 형태의 가짜 시각을 넣지 않는다.
    expect(alerts.every((a) => !/\d{1,2}:\d{2}/.test(`${a.title} ${a.body}`))).toBe(true);
    expect(alerts.every((a) => a.body.includes("청약홈"))).toBe(true);
  });
});
