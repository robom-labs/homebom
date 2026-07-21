// 목록에서 바로 펼쳐보는 청약 공고 의사결정 카드.
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import {
  addressSearchCandidates,
  ddayKst,
  formatKstDate,
  formatKstDateTime,
  formatManwon,
  getNoticeStatus,
  inferHousingCategory,
  isClosingSoon,
  naverMapSearchUrl,
  pyeongFromSqm,
} from "@zoopzoopcall/core";
import { Countdown } from "./Countdown";
import { CorrectionBadge, StatusBadge } from "./StatusBadge";
import { noticeSchedule } from "./noticeSchedule";
import { trackFamilyEvent } from "../analytics/familyAnalytics";

type Props = {
  notice: Notice;
  now: number;
  subscribed: boolean;
};

type InfoRowProps = {
  label: string;
  value: ReactNode;
  wide?: boolean;
};

function InfoRow({ label, value, wide = false }: InfoRowProps) {
  return (
    <div className={`decision-info__row${wide ? " decision-info__row--wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function trimDecimal(value: number, fractionDigits: number) {
  return value.toFixed(fractionDigits).replace(/\.?0+$/, "");
}

function modelAreas(notice: Notice): number[] {
  return Array.from(new Set((notice.modelSummaries ?? [])
    .map((model) => Number.parseFloat(String(model.supplyArea ?? "")))
    .filter((value) => Number.isFinite(value) && value > 0)))
    .sort((a, b) => a - b);
}

export function AreaValue({ areas }: { areas: number[] }) {
  if (areas.length === 0) return null;
  const first = areas[0];
  const last = areas[areas.length - 1];
  if (first === last) {
    return (
      <>
        <span className="detail__nowrap">{trimDecimal(first, 2)}㎡</span>
        <span className="detail__muted-separator"> · </span>
        <span className="detail__nowrap detail__accent">약 {trimDecimal(pyeongFromSqm(first), 1)}평</span>
      </>
    );
  }
  return (
    <>
      <span className="detail__nowrap">{trimDecimal(first, 2)}</span>
      <wbr />
      <span className="detail__nowrap">~{trimDecimal(last, 2)}㎡</span>
      <span className="detail__muted-separator"> · </span>
      <span className="detail__nowrap detail__accent">약 {trimDecimal(pyeongFromSqm(first), 1)}</span>
      <wbr />
      <span className="detail__nowrap detail__accent">~{trimDecimal(pyeongFromSqm(last), 1)}평</span>
    </>
  );
}

export function ManwonValue({ amount }: { amount: number }) {
  const text = formatManwon(amount);
  const spaceIndex = text.indexOf(" ");
  // "4억 8,200만원"처럼 억·만원 두 덩어리인 금액은 좁은 타일에서 통째로 nowrap이면
  // 카드 경계 밖으로 잘린다. 각 덩어리는 nowrap으로 붙여 읽되 사이에서만 줄바꿈되게 나눈다.
  if (spaceIndex === -1) return <span className="detail__nowrap">{text}</span>;
  return (
    <>
      <span className="detail__nowrap">{text.slice(0, spaceIndex)}</span>{" "}
      <span className="detail__nowrap">{text.slice(spaceIndex + 1)}</span>
    </>
  );
}

function PriceValue({ notice }: { notice: Notice }) {
  const { priceMin, priceMax } = notice;
  if (priceMin == null && priceMax == null) return null;
  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return (
      <>
        <ManwonValue amount={priceMin} />
        <span className="detail__muted-separator"> ~ </span>
        <ManwonValue amount={priceMax} />
      </>
    );
  }
  return <ManwonValue amount={priceMax ?? priceMin!} />;
}

function sumKnown(values: Array<number | undefined>): number | undefined {
  const known = values.filter((value): value is number => value != null);
  return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : undefined;
}

export function DecisionNoticeCard({ notice, now, subscribed }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = `list-decision-${useId().replace(/:/g, "")}`;
  const status = getNoticeStatus(notice, now);
  const closingSoon = isClosingSoon(notice, now);
  const finished = status === "마감" || status === "취소";
  const targetIso = status === "접수중" ? notice.receiptEnd : notice.receiptStart;
  const targetDday = ddayKst(targetIso, now);
  const deadlineBadge = status === "취소"
    ? "공고 취소"
    : status === "마감"
      ? "접수 마감"
      : status === "접수중"
        ? targetDday === 0 ? "오늘 마감 D-0" : `마감 D-${targetDday}`
        : targetDday === 0 ? "오늘 시작 D-0" : `시작 D-${targetDday}`;
  const housingCategory = inferHousingCategory(notice.housingCategory, notice.sourceOperation);
  const decision = notice.decisionSupport;
  const priceSignal = notice.priceSignal?.confidence === "high"
    && notice.priceSignal.source === "molit-trade"
    && notice.priceSignal.percentBelowMedian > 0
    && notice.priceSignal.sampleMonths > 0
    ? notice.priceSignal
    : undefined;
  const areas = modelAreas(notice);
  const schedule = noticeSchedule(notice).filter((item) => item.kind !== "announce");
  const generalSupply = sumKnown((notice.modelSummaries ?? []).map((model) => model.supplyCount));
  const specialSupply = sumKnown((notice.modelSummaries ?? []).map((model) => model.specialSupplyCount));
  const houseTypes = Array.from(new Set((notice.modelSummaries ?? [])
    .map((model) => model.houseType?.trim())
    .filter((value): value is string => Boolean(value))));
  const mapQuery = addressSearchCandidates(notice.address, notice.houseName, notice.region)[0];
  const isNoPriority = ["무순위", "잔여세대", "임의공급", "불법행위 재공급", "취소후재공급"].includes(notice.type);
  const showAccountRule = !isNoPriority || Boolean(decision?.subscriptionAccount);
  const receiptEvent = notice.events?.find((item) => ["receipt", "special", "rank1", "rank2", "no-priority"].includes(item.kind));
  const targetTimeConfirmed = status === "접수중" ? receiptEvent?.endTimeConfirmed === true : receiptEvent?.startTimeConfirmed === true;
  // 상세의 알림 섹션과 동일 기준: 확정 시각 알림 또는 날짜만 아는 세부 일정 알림이 가능할 때만 "알림 설정" 노출.
  const canSubscribe = targetTimeConfirmed || schedule.some((item) => item.id && ["special", "rank1", "rank2", "no-priority", "winner", "contract"].includes(item.kind));
  const hasEligibility = Boolean(
    (showAccountRule && decision?.subscriptionAccount)
    || decision?.selectionMethod
    || decision?.applicantQualification
    || decision?.transferRestriction
    || decision?.residenceRequirement
    || decision?.rewinningRestriction,
  );
  const hasSupplyComposition = notice.supplyCount != null || generalSupply != null || specialSupply != null;
  const company = [notice.businessOwnerName, decision?.constructionCompanyName].filter(Boolean).join(" · ");
  const hasComplexInfo = areas.length > 0 || houseTypes.length > 0 || Boolean(notice.moveInMonth || company || notice.contactPhone || notice.noticeUrl);
  const isApplyDeepLink = (() => {
    try {
      const url = new URL(notice.applyHomeUrl);
      return url.pathname !== "/" || url.search.length > 1;
    } catch { return false; }
  })();

  return (
    <article className={`decision-card decision-card--list${closingSoon ? " decision-card--urgent" : ""}${finished ? " decision-card--finished" : ""}`} aria-labelledby={`${moreId}-title`}>
      <header className="decision-card__deadline">
        <div>
          <span>{status === "접수중" ? "접수 마감까지" : status === "예정" || status === "정정" ? "접수 시작까지" : "접수 상태"}</span>
          {!finished && targetTimeConfirmed ? <Countdown targetIso={targetIso} /> : !finished ? <strong className="countdown__date">{formatKstDate(targetIso)}</strong> : <strong className="countdown__value">{status === "취소" ? "취소" : "마감"}</strong>}
        </div>
        <span className={`decision-card__dday${status === "접수중" && closingSoon ? " decision-card__dday--urgent" : ""}`}>{deadlineBadge}</span>
        <p>
          <b>접수기간</b>
          <span className="detail__nowrap">{targetTimeConfirmed ? formatKstDateTime(notice.receiptStart) : formatKstDate(notice.receiptStart)}</span>
          <span aria-hidden="true">~</span>
          <span className="detail__nowrap">{targetTimeConfirmed ? formatKstDateTime(notice.receiptEnd) : formatKstDate(notice.receiptEnd)}</span>
          {status === "접수중" && <span>· 한 번 놓치면 끝이에요</span>}
        </p>
      </header>

      <div className="decision-card__identity">
        <div className="detail__badges">
          <span className="badge badge--type">{notice.type}</span>
          {notice.supplyCount != null && (
            <span className="badge badge--open">
              <span className="detail__nowrap">{notice.supplyCount.toLocaleString("ko-KR")}세대</span>
              {decision?.selectionMethod ? ` · ${decision.selectionMethod}` : ""}
            </span>
          )}
          <StatusBadge status={status} />
          <CorrectionBadge corrected={notice.corrected} status={status} />
        </div>
        <h3 id={`${moreId}-title`} className="detail__title">
          <Link className="decision-card__title-link" to={`/notice/${encodeURIComponent(notice.id)}`}>{notice.houseName}</Link>
        </h3>
        <p>{notice.address || notice.region}</p>
        <p className="decision-card__type">{housingCategory}{notice.officialTypeName ? ` · ${notice.officialTypeName}` : ""}</p>
      </div>

      {priceSignal && (
        <aside className="price-signal" aria-label="인근 실거래 가격 비교">
          <div>
            <span>인근 실거래 대비</span>
            <strong><span className="detail__nowrap">{trimDecimal(priceSignal.percentBelowMedian, 1)}%</span> 낮음</strong>
          </div>
          <span className="price-signal__confidence">고신뢰</span>
          <p>{priceSignal.sourceLabel} · {priceSignal.comparisonAreaLabel} · 최근 <span className="detail__nowrap">{priceSignal.sampleMonths}개월</span> 중앙값</p>
        </aside>
      )}

      <div className="decision-card__tiles">
        {(notice.priceMin != null || notice.priceMax != null) && <div className="decision-tile">
          <span>분양가</span>
          <strong><PriceValue notice={notice} /></strong>
          <small>청약홈 구조화 값</small>
        </div>}
        {areas.length > 0 && <div className="decision-tile">
          <span>공급면적</span>
          <strong><AreaValue areas={areas} /></strong>
          <small>㎡와 평을 함께 표시</small>
        </div>}
        {notice.supplyCount != null && <div className="decision-tile">
          <span>모집세대</span>
          <strong><span className="detail__nowrap">{notice.supplyCount.toLocaleString("ko-KR")}세대</span></strong>
          <small>이번 공고 기준</small>
        </div>}
      </div>

      <a className="btn btn--primary btn--big decision-card__apply" href={notice.applyHomeUrl} target="_blank" rel="noreferrer" onClick={() => void trackFamilyEvent("official_apply_clicked", "notice-list")}>
        {isApplyDeepLink ? (status === "접수중" ? "청약홈에서 신청" : "청약홈 접수처 열기") : "청약홈 열기"}
      </a>
      <div className="decision-card__secondary-actions">
        {!finished && canSubscribe && <Link to={`/notice/${encodeURIComponent(notice.id)}#alerts`}>{subscribed ? "알림 설정됨" : "알림 설정"}</Link>}
        {mapQuery && <a href={naverMapSearchUrl(mapQuery)} target="_blank" rel="noreferrer">지도</a>}
      </div>

      <button
        className="decision-card__more"
        type="button"
        aria-expanded={moreOpen}
        aria-controls={moreId}
        onClick={() => setMoreOpen((open) => !open)}
      >
        {moreOpen ? "접기" : "나머지 정보 더 보기"}<span aria-hidden="true">{moreOpen ? "⌃" : "⌄"}</span>
      </button>

      {moreOpen && (
        <div id={moreId} className="decision-card__more-content">
          {hasEligibility && <section className="decision-section">
            <h4>신청 자격·제약</h4>
            <div className="decision-section__pair">
              {showAccountRule && decision?.subscriptionAccount && <div><span>청약통장</span><strong>{decision.subscriptionAccount}</strong></div>}
              {decision?.selectionMethod && <div><span>당첨 방식</span><strong>{decision.selectionMethod}</strong></div>}
            </div>
            <dl className="decision-info">
              {decision?.applicantQualification && <InfoRow label="신청 자격" value={decision.applicantQualification} wide />}
            </dl>
            <div className="decision-section__triple">
              {decision?.transferRestriction && <div><span>전매제한</span><strong>{decision.transferRestriction}</strong></div>}
              {decision?.residenceRequirement && <div><span>실거주 의무</span><strong>{decision.residenceRequirement}</strong></div>}
              {decision?.rewinningRestriction && <div><span>재당첨 제한</span><strong>{decision.rewinningRestriction}</strong></div>}
            </div>
          </section>}

          {decision?.paymentSchedule?.length ? <section className="decision-section">
            <h4>납부 일정</h4>
              <dl className="payment-list">
                {decision.paymentSchedule.map((payment) => (
                  <div key={`${payment.label}-${payment.timing ?? ""}`}>
                    <dt>{payment.label}</dt>
                    {payment.timing && <dd>{payment.timing}</dd>}
                    <strong>
                      {payment.ratio && <span className="detail__nowrap">{payment.ratio}</span>}
                      {payment.ratio && payment.amountManwon != null && <span aria-hidden="true"> · </span>}
                      {payment.amountManwon != null && <span className="detail__nowrap">{formatManwon(payment.amountManwon)}</span>}
                    </strong>
                  </div>
                ))}
              </dl>
          </section> : null}

          <section className="decision-section">
            <h4>청약 일정</h4>
            <ol className="decision-timeline">
              {schedule.map((item) => (
                <li key={item.id ?? `${item.kind}-${item.start}`}>
                  <span className={`schedule-dot schedule-dot--${item.kind}`} aria-hidden="true" />
                  <div>
                    <strong>{item.label}</strong>
                    <small>
                      <span className="detail__nowrap">{item.startTimeConfirmed ? formatKstDateTime(item.start) : formatKstDate(item.start)}</span>
                      {item.end && item.end !== item.start && <><span aria-hidden="true"> ~ </span><span className="detail__nowrap">{item.endTimeConfirmed ? formatKstDateTime(item.end) : formatKstDate(item.end)}</span></>}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {hasSupplyComposition && <section className="decision-section">
            <h4>공급 구성</h4>
            <div className="decision-section__triple decision-section__triple--supply">
              {notice.supplyCount != null && <div><strong>{notice.supplyCount}</strong><span>총 모집</span></div>}
              {generalSupply != null && <div><strong>{generalSupply}</strong><span>일반공급</span></div>}
              {specialSupply != null && <div><strong>{specialSupply}</strong><span>특별공급</span></div>}
            </div>
          </section>}

          {hasComplexInfo && <section className="decision-section">
            <h4>단지 정보</h4>
            <dl className="decision-info">
              {areas.length > 0 && <InfoRow label="면적" value={<AreaValue areas={areas} />} />}
              {houseTypes.length > 0 && <InfoRow label="주택형" value={houseTypes.join(" · ")} />}
              {notice.moveInMonth && <InfoRow label="입주 예정" value={<span className="detail__nowrap">{notice.moveInMonth}</span>} />}
              {company && <InfoRow label="시행·시공" value={company} wide />}
              {notice.contactPhone && <InfoRow label="문의" value={<span className="detail__nowrap">{notice.contactPhone}</span>} />}
              <InfoRow label="공식 접수처" value={<a href={notice.applyHomeUrl} target="_blank" rel="noreferrer" onClick={() => void trackFamilyEvent("official_apply_clicked", "notice-list")}>청약홈</a>} wide />
              {notice.noticeUrl && <InfoRow label="모집공고 원문" value={<a href={notice.noticeUrl} target="_blank" rel="noreferrer">청약홈 공고문 열기</a>} wide />}
            </dl>
          </section>}

          <p className="decision-card__verified">데이터 마지막 확인 <span className="detail__nowrap">{formatKstDateTime(notice.lastVerifiedAt)}</span> · 출처 청약홈</p>
          {decision?.costWarning && <p className="decision-card__warning">{decision.costWarning}</p>}
          <div className="decision-card__sources" aria-label="데이터 출처 구분">
            <span>청약홈 API 구조화 값</span>
            {decision && <span>공식 공고문 전용 값</span>}
            {priceSignal && <><span>국토부 실거래 외부값</span><span>청약봄 파생값</span></>}
          </div>
        </div>
      )}
    </article>
  );
}
