// 공고 상태(예정/접수중/마감/정정/취소) 배지.
import type { NoticeStatus } from "@zoopzoopcall/core";

const TONE: Record<NoticeStatus, string> = {
  접수중: "open",
  예정: "plan",
  마감: "done",
  정정: "warn",
  취소: "cancel",
};

export function StatusBadge({ status }: { status: NoticeStatus }) {
  return <span className={`badge badge--${TONE[status]}`}>{status}</span>;
}

export function TypeBadge({ type }: { type: string }) {
  return <span className="badge badge--type">{type}</span>;
}

// 정정 이력 배지. 이미 상태가 "정정"이면 중복이라 표시하지 않는다.
// (NoticeCard·DetailScreen에서 동일하게 쓰던 로직을 공용화)
export function CorrectionBadge({
  corrected,
  status,
}: {
  corrected?: boolean;
  status: NoticeStatus;
}) {
  if (!corrected || status === "정정") {
    return null;
  }
  return <span className="badge badge--warn">정정</span>;
}
