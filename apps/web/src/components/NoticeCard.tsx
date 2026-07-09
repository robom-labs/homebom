// 목록 화면의 공고 카드. 상태·D-day 도장·핵심 정보를 한눈에 보여준다.
import { Link } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import {
  ddayKst,
  formatKstDateTime,
  formatPriceRange,
  formatRemaining,
  getNoticeStatus,
  isClosingSoon,
  kstDateKey,
} from "@zoopzoopcall/core";
import { DdayStamp } from "./DdayStamp";
import { CorrectionBadge, StatusBadge, TypeBadge } from "./StatusBadge";

type Props = {
  notice: Notice;
  now: number;
  subscribed: boolean;
};

function receiptText(notice: Notice): string {
  const start = formatKstDateTime(notice.receiptStart);
  const sameDay =
    kstDateKey(Date.parse(notice.receiptStart)) === kstDateKey(Date.parse(notice.receiptEnd));
  const end = sameDay
    ? formatKstDateTime(notice.receiptEnd).split(" ").pop()
    : formatKstDateTime(notice.receiptEnd);
  return `${start} ~ ${end}`;
}

export function NoticeCard({ notice, now, subscribed }: Props) {
  const status = getNoticeStatus(notice, now);
  const closingSoon = isClosingSoon(notice, now);
  const finished = status === "마감" || status === "취소";

  let stamp: { label: string; tone: "red" | "ink" | "gray" } | null = null;
  if (status === "접수중") {
    const d = ddayKst(notice.receiptEnd, now);
    stamp = {
      label: d === 0 ? "오늘 마감" : `마감 D-${d}`,
      tone: closingSoon || d === 0 ? "red" : "ink",
    };
  } else if (status === "예정" || status === "정정") {
    const d = ddayKst(notice.receiptStart, now);
    stamp = { label: d === 0 ? "오늘 시작" : `D-${d}`, tone: d === 0 ? "red" : "ink" };
  }

  const price = formatPriceRange(notice);
  const eyebrow = [notice.region, notice.supplyCount ? `${notice.supplyCount}세대` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to={`/notice/${notice.id}`}
      className={`card${closingSoon ? " card--urgent" : ""}${finished ? " card--finished" : ""}`}
    >
      <div className="card__top">
        <div className="card__badges">
          <TypeBadge type={notice.type} />
          <StatusBadge status={status} />
          <CorrectionBadge corrected={notice.corrected} status={status} />
        </div>
        {stamp && <DdayStamp label={stamp.label} tone={stamp.tone} />}
      </div>
      <h3 className="card__title">{notice.houseName}</h3>
      <p className="card__eyebrow">{eyebrow}</p>
      <dl className="card__info">
        <div className="card__info-row">
          <dt className="card__label">분양가</dt>
          <dd className={`card__value${price ? " card__value--price" : " card__value--muted"}`}>
            {price ?? "공고문 확인"}
          </dd>
        </div>
        <div className="card__info-row">
          <dt className="card__label">접수</dt>
          <dd className="card__value">{receiptText(notice)}</dd>
        </div>
      </dl>
      <div className="card__foot">
        {status === "접수중" && (
          <span className={`card__left${closingSoon ? " card__left--urgent" : ""}`}>
            마감까지 {formatRemaining(Date.parse(notice.receiptEnd) - now)}
          </span>
        )}
        {(status === "예정" || status === "정정") && (
          <span className="card__left">
            시작까지 {formatRemaining(Date.parse(notice.receiptStart) - now)}
          </span>
        )}
        {subscribed && !finished && <span className="card__bell">알림 켜짐</span>}
      </div>
    </Link>
  );
}
