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
