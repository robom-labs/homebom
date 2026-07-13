// 청약 일정 의미 순서와 전체 접수 기간 중복 제거를 검증한다.
import { describe, expect, it } from "vitest";
import type { Notice } from "@zoopzoopcall/core";
import { buildAptEvents } from "@zoopzoopcall/core";
import { eventPriority, noticeSchedule, shortEventLabel } from "../noticeSchedule";

const base: Notice = {
  id: "n1",
  type: "일반공급",
  houseName: "테스트 자이",
  region: "서울",
  receiptStart: "2026-07-15T00:00:00.000Z",
  receiptEnd: "2026-07-15T08:30:00.000Z",
  applyHomeUrl: "https://www.applyhome.co.kr",
  lastVerifiedAt: "2026-07-01T00:00:00.000Z",
};

describe("noticeSchedule", () => {
  it("세부 접수 일정이 있으면 전체 접수 기간을 중복 표시하지 않는다", () => {
    const events = buildAptEvents({
      HOUSE_NM: "테스트 자이",
      RCEPT_BGNDE: "2026-07-15",
      RCEPT_ENDDE: "2026-07-17",
      SPSPLY_RCEPT_BGNDE: "2026-07-15",
      SPSPLY_RCEPT_ENDDE: "2026-07-15",
      GNRL_RNK1_CRSPAREA_RCPTDE: "2026-07-16",
      GNRL_RNK2_CRSPAREA_RCPTDE: "2026-07-17",
    }, base.id);
    expect(events.some((item) => item.kind === "receipt")).toBe(false);
    expect(events.map((item) => item.kind)).toEqual(["special", "rank1", "rank2"]);
  });

  it("같은 날은 특별공급, 1순위 지역, 2순위, 발표, 계약, 공고 순이다", () => {
    const start = "2026-07-15T00:00:00.000Z";
    const notice = {
      ...base,
      events: [
        { kind: "announce" as const, label: "모집공고", start },
        { kind: "contract" as const, label: "계약", start },
        { kind: "rank1" as const, label: "1순위 기타지역", regionScope: "other" as const, start },
        { kind: "rank1" as const, label: "1순위 해당지역", regionScope: "local" as const, start },
        { kind: "special" as const, label: "특별공급", start },
        { kind: "winner" as const, label: "당첨자 발표", start },
        { kind: "rank2" as const, label: "2순위 해당지역", regionScope: "local" as const, start },
      ],
    };
    expect(noticeSchedule(notice).map((item) => item.label)).toEqual([
      "특별공급", "1순위 해당지역", "1순위 기타지역", "2순위 해당지역", "당첨자 발표", "계약", "모집공고",
    ]);
  });

  it("달력용 라벨과 우선순위를 안정적으로 제공한다", () => {
    const event = { kind: "rank1" as const, label: "1순위 해당지역", regionScope: "local" as const, start: base.receiptStart };
    expect(shortEventLabel(event, base)).toBe("1순위");
    expect(eventPriority(event, base)).toBeLessThan(eventPriority({ ...event, kind: "rank2" }, base));
  });
});
