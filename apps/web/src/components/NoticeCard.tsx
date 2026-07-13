// 목록 화면의 공고 카드. 상태·D-day 도장·핵심 정보를 한눈에 보여준다.
import { Link } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import {
  ddayKst,
  formatArea,
  formatHouseholdSummary,
  formatHouseTypeLabel,
  formatKstDate,
  formatKstDateTime,
  formatPriceRange,
  formatRemaining,
  getNoticeStatus,
  inferHousingCategory,
  isClosingSoon,
  kstDateKey,
  addressSearchCandidates,
  naverMapSearchUrl,
} from "@zoopzoopcall/core";
import { DdayStamp } from "./DdayStamp";
import { CorrectionBadge, StatusBadge, TypeBadge } from "./StatusBadge";
import { nextNoticeEvent } from "./noticeSchedule";
import { specialSupplySummary } from "./specialSupply";

type Props = {
  notice: Notice;
  now: number;
  subscribed: boolean;
  compact?: boolean;
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

export function NoticeCard({ notice, now, subscribed, compact = false }: Props) {
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
  const models = notice.modelSummaries ?? [];
  // 대표 평형은 일반공급 세대수가 가장 많은 주택형(없으면 첫 번째)으로 고른다.
  const model = models.reduce<typeof models[number] | undefined>(
    (best, m) => ((m.supplyCount ?? 0) > (best?.supplyCount ?? 0) ? m : best),
    models[0],
  );
  const housingCategory = inferHousingCategory(notice.housingCategory, notice.sourceOperation);
  const houseType = formatHouseTypeLabel(model?.houseType);
  const areaText = formatArea(model?.supplyArea);
  const distinctAreas = new Set(models.map((m) => m.supplyArea).filter(Boolean));
  const area = areaText ? (distinctAreas.size > 1 ? `${areaText} 외` : areaText) : "면적 확인";
  const houseSpec = [houseType, areaText ? area : null].filter(Boolean).join(" · ") || "공고문 확인";
  const households = formatHouseholdSummary(notice.totalHouseholdCount, notice.supplyCount);
  const nextEvent = nextNoticeEvent(notice, now);
  const nextEventText = nextEvent
    ? `${nextEvent.label} · ${formatKstDate(nextEvent.start)}${Date.parse(nextEvent.start) <= now && Date.parse(nextEvent.end ?? nextEvent.start) >= now ? " 진행 중" : ""}`
    : "전체 일정 종료";
  const regularSupply = models.reduce((sum, item) => sum + (item.supplyCount ?? 0), 0);
  const specialSupply = models.reduce((sum, item) => sum + (item.specialSupplyCount ?? 0), 0);
  const areaValues = models
    .map((item) => Number.parseFloat(String(item.supplyArea ?? "")))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const areaRange = areaValues.length > 0
    ? `${formatArea(areaValues[0])}${areaValues.length > 1 && areaValues.at(-1) !== areaValues[0] ? ` ~ ${formatArea(areaValues.at(-1))}` : ""}`
    : "공고문 확인";
  const specialSummary = specialSupplySummary(models);
  const mapQuery = addressSearchCandidates(notice.address, notice.houseName, notice.region)[0];

  if (compact) {
    return (
      <Link className="agenda-link" to={`/notice/${notice.id}`}>
        <span>{notice.region} · {notice.supplyCount != null ? `${notice.supplyCount}세대` : "모집 세대 확인"}</span>
        <strong>상세 보기 ›</strong>
      </Link>
    );
  }

  return (
    <article className={`card${closingSoon ? " card--urgent" : ""}${finished ? " card--finished" : ""}`}>
      <Link to={`/notice/${notice.id}`} className="card__detail-link">
      <div className="card__top">
        <div className="card__badges">
          <TypeBadge type={notice.type} />
          <StatusBadge status={status} />
          <CorrectionBadge corrected={notice.corrected} status={status} />
        </div>
        {stamp && <DdayStamp label={stamp.label} tone={stamp.tone} />}
      </div>
      <p className="card__event">{nextEventText}</p>
      <h3 className="card__title">{notice.houseName}</h3>
      <p className="card__meta">{notice.region} · {housingCategory}</p>
      <dl className="card__info">
        <div className="card__info-row card__info-row--wide card__info-row--households"><dt className="card__label">세대</dt><dd className="card__value">{households}</dd></div>
        <div className="card__info-row card__info-row--wide"><dt className="card__label">분양가</dt><dd className={`card__value${price ? " card__value--price" : " card__value--muted"}`}>{price ?? "공고문 확인"}</dd></div>
        <div className="card__info-row"><dt className="card__label">공급 세대</dt><dd className="card__value">{models.length > 0 ? `일반 ${regularSupply} · 특별 ${specialSupply}` : households}</dd></div>
        <div className="card__info-row"><dt className="card__label">공급면적</dt><dd className="card__value">{areaRange}</dd></div>
        <div className="card__info-row"><dt className="card__label">당첨 발표</dt><dd className="card__value">{notice.winnerDate ? formatKstDate(notice.winnerDate) : "공고문 확인"}</dd></div>
        <div className="card__info-row"><dt className="card__label">대표 주택형</dt><dd className="card__value card__value--next">{houseSpec}</dd></div>
        {specialSummary && <div className="card__info-row card__info-row--wide"><dt className="card__label">특별공급</dt><dd className="card__value">{specialSummary}</dd></div>}
        <div className="card__info-row card__info-row--wide"><dt className="card__label">접수 기간</dt><dd className="card__value">{receiptText(notice)}</dd></div>
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
      <div className="card__actions">
        <a href={notice.noticeUrl ?? notice.applyHomeUrl} target="_blank" rel="noreferrer">공식 접수처</a>
        <Link to={`/notice/${notice.id}#alerts`}>{subscribed ? "알림 설정됨" : "알림 설정"}</Link>
        {mapQuery && <a href={naverMapSearchUrl(mapQuery)} target="_blank" rel="noreferrer">지도</a>}
      </div>
    </article>
  );
}
