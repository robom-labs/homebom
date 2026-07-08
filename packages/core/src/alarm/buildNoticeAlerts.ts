// 접수 시작·마감 알림 시각을 계산하는 순수함수. 과거 시각은 예약하지 않는다.
import type { Notice } from "../notice/types";

export type AlertKind = "open" | "close";

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
