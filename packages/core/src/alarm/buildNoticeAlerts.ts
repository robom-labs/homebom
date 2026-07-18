// 접수 시작·마감 알림 시각을 계산하는 순수함수. 과거 시각은 예약하지 않는다.
import type { ApplicationEvent, Notice } from "../notice/types";
import { kstDateKey } from "../time/kst";

export type AlertKind = "open" | "close" | "event";

export type NoticeAlert = {
  /** noticeId:kind:offset 형태의 결정적 ID. 중복 발송 방지에 쓴다. */
  id: string;
  noticeId: string;
  kind: AlertKind;
  offsetMinutes: number;
  /** 알림을 울릴 시각 (UTC ms). */
  fireAt: number;
  title: string;
  body: string;
  url: string;
};

/** 접수 시작 기본 프리셋: 1일 전, 3시간 전, 정각. */
export const DEFAULT_OPEN_OFFSETS = [1440, 180, 0];
/** 접수 마감 기본 프리셋: 1일 전, 3시간 전, 1시간 전. */
export const DEFAULT_CLOSE_OFFSETS = [1440, 180, 60];

/** 분 단위 오프셋을 "1일", "3시간", "30분", "정각"으로 표기한다. */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return "정각";
  if (minutes % 1440 === 0) return `${minutes / 1440}일`;
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  return `${minutes}분`;
}

/**
 * 공고 하나에 대해 kind(시작/마감)별 알림 목록을 만든다.
 * fireAt이 now 이하인(이미 지난) 알림은 제외한다.
 */
export function buildNoticeAlerts(
  notice: Notice,
  kind: AlertKind,
  offsetsMinutes: number[],
  now: number,
): NoticeAlert[] {
  if (kind === "event") return [];
  if (notice.cancelled || notice.missingFromFeed || Date.parse(notice.receiptEnd) < now) return [];
  const receiptEvent = notice.events?.find((event) => ["receipt", "special", "rank1", "rank2", "no-priority"].includes(event.kind));
  const confirmed = kind === "open" ? receiptEvent?.startTimeConfirmed === true : receiptEvent?.endTimeConfirmed === true;
  if (!confirmed) return [];
  const target = Date.parse(kind === "open" ? notice.receiptStart : notice.receiptEnd);
  return offsetsMinutes
    .map((off) => {
      const title =
        kind === "open"
          ? off === 0
            ? `[${notice.houseName}] 줍줍 접수 시작!`
            : `[${notice.houseName}] 접수 시작 ${offsetLabel(off)} 전`
          : `[${notice.houseName}] 접수 마감 ${offsetLabel(off)} 전`;
      const body =
        kind === "open"
          ? "접수 시작 시간입니다. 모집공고 원문과 청약홈에서 신청 조건을 확인하세요."
          : "곧 마감됩니다. 모집공고 원문과 청약홈에서 마감 전 절차를 확인하세요.";
      return {
        id: `${notice.id}:${kind}:${off}`,
        noticeId: notice.id,
        kind,
        offsetMinutes: off,
        fireAt: target - off * 60_000,
        title,
        body,
        url: notice.noticeUrl ?? notice.applyHomeUrl,
      };
    })
    .filter((a) => a.fireAt > now);
}

/** 날짜만 아는 일정(발표·계약 등)의 리마인더 기준 시각: 당일 09:00 KST. */
const DATE_ONLY_REMINDER_HOUR_KST = "09:00";
/** 날짜만 아는 일정의 리마인더 오프셋: 하루 전 09:00, 당일 09:00. */
const DATE_ONLY_OFFSETS = [1440, 0];

/** 일정의 KST 달력 날짜 09:00(KST)을 UTC ms로 반환한다. 정확한 시각을 주장하지 않는다. */
function dateOnlyReminderAnchor(startIso: string): number {
  return Date.parse(`${kstDateKey(Date.parse(startIso))}T${DATE_ONLY_REMINDER_HOUR_KST}:00+09:00`);
}

/**
 * 선택한 세부 일정에 대한 알림을 만든다.
 * - 정확한 시각을 아는 일정(startTimeConfirmed): 시작 시각 기준 하루 전·한 시간 전.
 * - 날짜만 아는 일정(발표·계약 등): 청약홈이 시각을 주지 않으므로 당일 09:00 KST 기준
 *   전일·당일 리마인더만 보낸다. 제목·본문에서 가짜 시각을 주장하지 않는다.
 */
export function buildEventAlerts(
  notice: Notice,
  events: ApplicationEvent[],
  now: number,
  offsetsMinutes = [1440, 60],
): NoticeAlert[] {
  // 발표·계약 같은 세부 일정은 본질적으로 접수 마감(receiptEnd) 이후에 온다.
  // 여기서 receiptEnd로 막으면 그 리마인더가 영영 예약되지 않으므로 막지 않고,
  // 아래 `fireAt > now` 필터로 과거 알림만 제외한다(취소·피드 이탈만 차단).
  if (notice.cancelled || notice.missingFromFeed) return [];
  return events.flatMap((event) => {
    const base = event.id ?? `${notice.id}:${event.kind}`;
    if (event.startTimeConfirmed === true) {
      return offsetsMinutes.map((off) => ({
        id: `${base}:event:${off}`,
        noticeId: notice.id,
        kind: "event" as const,
        offsetMinutes: off,
        fireAt: Date.parse(event.start) - off * 60_000,
        title: `[${notice.houseName}] ${event.label} ${offsetLabel(off)} 전`,
        body: "청약홈 모집공고 원문에서 대상 지역과 신청 조건을 확인하세요.",
        url: notice.noticeUrl ?? notice.applyHomeUrl,
      }));
    }
    const anchor = dateOnlyReminderAnchor(event.start);
    return DATE_ONLY_OFFSETS.map((off) => ({
      id: `${base}:event:${off}`,
      noticeId: notice.id,
      kind: "event" as const,
      offsetMinutes: off,
      fireAt: anchor - off * 60_000,
      title: off === 0 ? `[${notice.houseName}] 오늘 ${event.label}` : `[${notice.houseName}] 내일 ${event.label}`,
      body: "정확한 시각은 아직 정해지지 않았어요. 청약홈 모집공고 원문에서 시각과 대상 조건을 확인하세요.",
      url: notice.noticeUrl ?? notice.applyHomeUrl,
    }));
  }).filter((alert) => alert.fireAt > now);
}

/**
 * 이 공고와 관련해 알림이 울릴 수 있는 가장 늦은 날짜(UTC ms).
 * 구독 스냅샷을 언제까지 보존할지 결정하는 데 쓴다. 발표·계약이 접수 마감보다
 * 늦으므로 receiptEnd만으로 정리하면 그 알림 전에 공고가 사라진다.
 */
export function latestNoticeAlertDate(notice: Notice): number {
  const candidates: Array<string | undefined> = [
    notice.receiptEnd,
    notice.winnerDate,
    notice.contractStartDate,
    notice.contractEndDate,
  ];
  for (const event of notice.events ?? []) {
    candidates.push(event.end, event.start);
  }
  let latest = 0;
  for (const value of candidates) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return latest;
}
