// 과거 버그 경로를 직접 재현·차단하는 회귀 테스트.
// 1) v0.1.0 영구 억제 버그: 권한이 granted 가 아닐 때 check 가 fired 기록을 남기면 안 된다.
// 2) collectDueAlerts 의 6시간 유예창 경계.
// 3) delivering 인플라이트 가드: 동시 호출이 같은 알림을 두 번 전달하면 안 된다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notice, NoticeAlert } from "@zoopzoopcall/core";
import { collectDueAlerts, deliverDueAlert, startAlertScheduler } from "../scheduler";
import { loadFired, markFired } from "../../store/subscriptions";
import type { SubMap } from "../../store/subscriptions";

/** node 환경용 인메모리 localStorage (loadFired/markFired 가 사용). */
function createLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  } as unknown as Storage;
}

/** startAlertScheduler 가 요구하는 window/document 최소 스텁. */
function stubDom() {
  vi.stubGlobal("window", {
    setInterval: () => 0,
    clearInterval: () => {},
  });
  vi.stubGlobal("document", {
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: "visible",
  });
}

const makeNotice = (id: string, receiptStartMs: number): Notice => ({
  id,
  type: "무순위",
  houseName: `단지 ${id}`,
  region: "서울",
  receiptStart: new Date(receiptStartMs).toISOString(),
  receiptEnd: new Date(receiptStartMs + 8 * 3600_000).toISOString(),
  applyHomeUrl: "https://www.applyhome.co.kr",
  lastVerifiedAt: new Date(receiptStartMs - 86400_000).toISOString(),
});

/** 비동기 전달 체인(마이크로태스크)을 한 번 비운다. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.stubGlobal("localStorage", createLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startAlertScheduler 권한 가드 (v0.1.0 영구 억제 버그 회귀)", () => {
  it("권한이 granted 가 아니면 도래한 알림을 fired 로 기록하지 않는다", async () => {
    stubDom();
    vi.stubGlobal("Notification", { permission: "denied" });

    // 1분 전에 도래한 알림 — 유예창(6h) 안이라 원래대로면 울릴 대상.
    const notice = makeNotice("P1", Date.now() - 60_000);
    const subs: SubMap = { P1: { open: [0], close: [] } };

    const stop = startAlertScheduler(() => ({ notices: [notice], subs, noticeSnapshots: {} }));
    await flush();
    stop();

    // 울리지도, "울린 것"으로 찍히지도 않아야 한다.
    expect(loadFired()).toEqual({});
    // 나중에 권한을 허용하면(유예창 안) 여전히 수집돼 울릴 수 있어야 한다 = 영구 억제 아님.
    const stillDue = collectDueAlerts([notice], subs, Date.now());
    expect(stillDue.map((a) => a.id)).toEqual(["P1:open:0"]);
  });

  it("권한이 granted 면 같은 알림을 표시하고 fired 로 기록한다 (대조군)", async () => {
    stubDom();
    class FakeNotification {
      static permission = "granted";
      constructor(_title: string, _options?: unknown) {}
    }
    vi.stubGlobal("Notification", FakeNotification);

    const notice = makeNotice("P2", Date.now() - 60_000);
    const subs: SubMap = { P2: { open: [0], close: [] } };

    const stop = startAlertScheduler(() => ({ notices: [notice], subs, noticeSnapshots: {} }));
    await flush();
    stop();

    expect(Object.keys(loadFired())).toEqual(["P2:open:0"]);
  });
});

describe("collectDueAlerts 6시간 유예창", () => {
  const now = Date.parse("2026-07-10T12:00:00Z");
  const min = 60_000;

  it("5시간 59분 지난 알림은 수집한다", () => {
    const notice = makeNotice("G1", now - (5 * 60 + 59) * min);
    const subs: SubMap = { G1: { open: [0], close: [] } };

    const due = collectDueAlerts([notice], subs, now);

    expect(due.map((a) => a.id)).toEqual(["G1:open:0"]);
  });

  it("6시간 1분 지난 알림은 버린다", () => {
    const notice = makeNotice("G2", now - (6 * 60 + 1) * min);
    const subs: SubMap = { G2: { open: [0], close: [] } };

    expect(collectDueAlerts([notice], subs, now)).toEqual([]);
  });

  it("이미 fired 기록이 있는 알림은 제외한다", () => {
    const notice = makeNotice("G3", now - 59 * min);
    const subs: SubMap = { G3: { open: [0], close: [] } };
    markFired("G3:open:0");

    expect(collectDueAlerts([notice], subs, now)).toEqual([]);
  });
});

describe("deliverDueAlert delivering 인플라이트 가드", () => {
  it("동시에 두 번 호출해도 같은 알림을 한 번만 전달·기록한다", async () => {
    const alert: NoticeAlert = {
      id: "D1:open:0",
      noticeId: "D1",
      kind: "open",
      offsetMinutes: 0,
      fireAt: Date.parse("2026-07-10T00:00:00Z"),
      title: "접수 시작",
      body: "지금 접수가 시작됐어요.",
      url: "https://www.applyhome.co.kr",
    };

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let notifyCalls = 0;
    const recorded: string[] = [];
    const slowNotify = async () => {
      notifyCalls += 1;
      await gate;
      return true;
    };

    const first = deliverDueAlert(alert, slowNotify, (id) => recorded.push(id));
    const second = deliverDueAlert(alert, slowNotify, (id) => recorded.push(id));
    release();
    const [firstShown, secondShown] = await Promise.all([first, second]);

    expect(notifyCalls).toBe(1);
    expect(firstShown).toBe(true);
    expect(secondShown).toBe(false);
    expect(recorded).toEqual([alert.id]);
  });
});
