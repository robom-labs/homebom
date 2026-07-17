// 알림 계산과 실제 표시 성공 여부에 따른 발송 기록을 검증한다.
import { describe, expect, it } from "vitest";
import type { Notice } from "@zoopzoopcall/core";
import { collectPendingAlerts, deliverDueAlert, MAX_TIMER_DELAY, nextAlertWakeDelay } from "../scheduler";
import type { NoticeSnapshotMap, SubMap } from "../../store/subscriptions";

const makeNotice = (overrides: Partial<Notice> & { id: string }): Notice => ({
  type: "무순위",
  houseName: `단지 ${overrides.id}`,
  region: "서울",
  receiptStart: "2026-07-10T00:00:00.000Z", // KST 7/10 09:00
  receiptEnd: "2026-07-10T08:30:00.000Z", // KST 7/10 17:30
  applyHomeUrl: "https://www.applyhome.co.kr",
  lastVerifiedAt: "2026-07-01T00:00:00.000Z",
  events: [{
    kind: "no-priority",
    label: "접수",
    start: "2026-07-10T00:00:00.000Z",
    end: "2026-07-10T08:30:00.000Z",
    timeSource: "official",
    startTimeConfirmed: true,
    endTimeConfirmed: true,
    confirmed: true,
  }],
  ...overrides,
});

const T = (iso: string) => Date.parse(iso);

describe("collectPendingAlerts", () => {
  it("구독된 공고의 open/close 알림을 시간순으로 정렬해 반환한다", () => {
    const notice = makeNotice({ id: "N1" });
    const subs: SubMap = { N1: { open: [180, 0], close: [60] } };
    const now = T("2026-07-01T00:00:00Z");

    const alerts = collectPendingAlerts([notice], subs, now);

    expect(alerts).toHaveLength(3);
    expect(alerts.map((a) => a.fireAt)).toEqual(
      [...alerts.map((a) => a.fireAt)].sort((x, y) => x - y),
    );
    // 시작 3시간 전(open:180, 7/9 21:00) < 정각(open:0, 7/10 00:00) < 마감 1시간 전(close:60, 7/10 07:30) 순.
    expect(alerts.map((a) => a.id)).toEqual(["N1:open:180", "N1:open:0", "N1:close:60"]);
  });

  it("구독되지 않은 공고와 cancelled 공고는 제외한다", () => {
    const notSubscribed = makeNotice({ id: "N2" });
    const cancelled = makeNotice({ id: "N3", cancelled: true });
    const subs: SubMap = { N3: { open: [0], close: [] } };
    const now = T("2026-07-01T00:00:00Z");

    const alerts = collectPendingAlerts([notSubscribed, cancelled], subs, now);

    expect(alerts).toHaveLength(0);
  });

  it("notices 배열에 없어도 noticeSnapshots에 있으면 병합해 알림을 만든다", () => {
    const snapshotOnly = makeNotice({ id: "N4" });
    const noticeSnapshots: NoticeSnapshotMap = { N4: snapshotOnly };
    const subs: SubMap = { N4: { open: [0], close: [] } };
    const now = T("2026-07-01T00:00:00Z");

    const alerts = collectPendingAlerts([], subs, now, noticeSnapshots);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("N4:open:0");
  });

  it("notices 배열이 noticeSnapshots보다 우선한다", () => {
    const stale = makeNotice({ id: "N5", cancelled: true });
    const fresh = makeNotice({ id: "N5", cancelled: false });
    const noticeSnapshots: NoticeSnapshotMap = { N5: stale };
    const subs: SubMap = { N5: { open: [0], close: [] } };
    const now = T("2026-07-01T00:00:00Z");

    const alerts = collectPendingAlerts([fresh], subs, now, noticeSnapshots);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("N5:open:0");
  });
});

describe("deliverDueAlert", () => {
  const alert = {
    id: "N1:open:0",
    noticeId: "N1",
    kind: "open" as const,
    offsetMinutes: 0,
    fireAt: T("2026-07-10T00:00:00Z"),
    title: "접수 시작",
    body: "지금 접수가 시작됐어요.",
    url: "https://www.applyhome.co.kr",
  };

  it("알림 표시가 성공한 뒤에만 발송 완료로 기록한다", async () => {
    const recorded: string[] = [];

    const shown = await deliverDueAlert(alert, async () => true, (id) => recorded.push(id));

    expect(shown).toBe(true);
    expect(recorded).toEqual([alert.id]);
  });

  it("알림 표시가 실패하면 발송 완료로 기록하지 않는다", async () => {
    const recorded: string[] = [];

    const shown = await deliverDueAlert(alert, async () => false, (id) => recorded.push(id));

    expect(shown).toBe(false);
    expect(recorded).toEqual([]);
  });
});

describe("nextAlertWakeDelay", () => {
  it("가장 가까운 미래 알림 시각에 맞춰 깨운다", () => {
    const now = T("2026-07-01T00:00:00Z");
    const alerts = [
      { id: "later", fireAt: now + 20_000 },
      { id: "next", fireAt: now + 3_000 },
    ] as never[];
    expect(nextAlertWakeDelay(alerts, now)).toBe(3_250);
  });

  it("24.8일보다 먼 알림은 재무장 상한을 사용하고 미래 알림이 없으면 null이다", () => {
    const now = T("2026-07-01T00:00:00Z");
    expect(nextAlertWakeDelay([{ fireAt: now + MAX_TIMER_DELAY + 1 } as never], now)).toBe(MAX_TIMER_DELAY);
    expect(nextAlertWakeDelay([], now)).toBeNull();
  });
});

describe("피드에서 내려간 공고(missingFromFeed) 알림 억제", () => {
  it("missingFromFeed 스냅샷은 예정 알림에서 제외한다", () => {
    // 접수 시작 전(미래)이라 원래라면 시작 알림이 잡히는 공고
    const future = makeNotice({
      id: "N-missing",
      receiptStart: "2999-01-01T00:00:00.000Z",
      receiptEnd: "2999-01-02T00:00:00.000Z",
      events: [{
        kind: "no-priority", label: "접수",
        start: "2999-01-01T00:00:00.000Z", end: "2999-01-02T00:00:00.000Z",
        timeSource: "official", startTimeConfirmed: true, endTimeConfirmed: true, confirmed: true,
      }],
    });
    const subs: SubMap = { "N-missing": { open: [0], close: [0], eventIds: [] } };
    const now = T("2026-07-01T00:00:00.000Z");
    // 피드에는 없고 스냅샷만 있는 상태
    const liveSnap: NoticeSnapshotMap = { "N-missing": future };
    expect(collectPendingAlerts([], subs, now, liveSnap).length).toBeGreaterThan(0);
    // missingFromFeed 표시되면 알림이 사라진다
    const flagged: NoticeSnapshotMap = { "N-missing": { ...future, missingFromFeed: true } };
    expect(collectPendingAlerts([], subs, now, flagged)).toEqual([]);
  });
});
