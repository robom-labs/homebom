// 알림 계산과 실제 표시 성공 여부에 따른 발송 기록을 검증한다.
import { describe, expect, it } from "vitest";
import type { Notice } from "@zoopzoopcall/core";
import { collectPendingAlerts, deliverDueAlert } from "../scheduler";
import type { NoticeSnapshotMap, SubMap } from "../../store/subscriptions";

const makeNotice = (overrides: Partial<Notice> & { id: string }): Notice => ({
  type: "무순위",
  houseName: `단지 ${overrides.id}`,
  region: "서울",
  receiptStart: "2026-07-10T00:00:00.000Z", // KST 7/10 09:00
  receiptEnd: "2026-07-10T08:30:00.000Z", // KST 7/10 17:30
  applyHomeUrl: "https://www.applyhome.co.kr",
  lastVerifiedAt: "2026-07-01T00:00:00.000Z",
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
