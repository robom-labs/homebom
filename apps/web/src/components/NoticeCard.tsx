// 목록 화면의 공고 카드. 상태·D-day 도장·핵심 정보를 한눈에 보여준다.
import { Link } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import { DecisionNoticeCard } from "./DecisionNoticeCard";

type Props = {
  notice: Notice;
  now: number;
  subscribed: boolean;
  compact?: boolean;
};

export function NoticeCard({ notice, now, subscribed, compact = false }: Props) {
  if (compact) {
    return (
      <Link className="agenda-link" to={`/notice/${notice.id}`}>
        <span>{notice.region} · {notice.supplyCount != null ? `${notice.supplyCount}세대` : "모집 세대 확인"}</span>
        <strong>상세 보기 ›</strong>
      </Link>
    );
  }

  return <DecisionNoticeCard notice={notice} now={now} subscribed={subscribed} />;
}
