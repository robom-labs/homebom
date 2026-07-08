// 현재 시각과 접수 기간으로 공고 상태를 판정하는 순수함수.
import type { Notice, NoticeStatus } from "./types";

/**
 * 상태 판정 규칙.
 * - 취소공고는 언제나 "취소".
 * - 접수 시작 전: 정정공고면 "정정", 아니면 "예정".
 * - 접수 기간 중: "접수중" (정정 여부는 배지로 별도 표시).
 * - 접수 종료 후: "마감".
 */
export function getNoticeStatus(notice: Notice, now: number): NoticeStatus {
  if (notice.cancelled) return "취소";
  const start = Date.parse(notice.receiptStart);
  const end = Date.parse(notice.receiptEnd);
  if (now < start) return notice.corrected ? "정정" : "예정";
  if (now <= end) return "접수중";
  return "마감";
}

/** 접수중이면서 마감까지 남은 시간이 임계값(기본 6시간) 이하인지. */
export function isClosingSoon(notice: Notice, now: number, thresholdMs = 6 * 3600_000): boolean {
  if (getNoticeStatus(notice, now) !== "접수중") return false;
  return Date.parse(notice.receiptEnd) - now <= thresholdMs;
}
