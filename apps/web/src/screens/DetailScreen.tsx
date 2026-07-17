// 공고 상세 화면. 공식 데이터와 공고문 값을 구분해 신청 판단 순서로 보여준다.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import {
  DEFAULT_CLOSE_OFFSETS,
  DEFAULT_OPEN_OFFSETS,
  addressSearchCandidates,
  ddayKst,
  formatKstDate,
  formatKstDateTime,
  formatManwon,
  getNoticeStatus,
  inferHousingCategory,
  isClosingSoon,
  kakaoMapSearchUrl,
  naverMapSearchUrl,
  offsetLabel,
  pyeongFromSqm,
  type AlertKind,
} from "@zoopzoopcall/core";
import { Countdown } from "../components/Countdown";
import { CorrectionBadge, StatusBadge } from "../components/StatusBadge";
import { PermissionBanner } from "../components/PermissionBanner";
import { useNow } from "../hooks/useNow";
import {
  notificationSupport,
  requestPermission,
  type PermissionState,
} from "../notify/notifications";
import type { useSubscriptions } from "../hooks/useSubscriptions";
import { noticeSchedule } from "../components/noticeSchedule";
import { trackFamilyEvent } from "../analytics/familyAnalytics";

type Props = {
  notices: Notice[];
  subscriptions: ReturnType<typeof useSubscriptions>;
  loading: boolean;
  error: string | null;
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

function AreaValue({ areas }: { areas: number[] }) {
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
      <span className="detail__nowrap">{trimDecimal(first, 2)}~{trimDecimal(last, 2)}㎡</span>
      <span className="detail__muted-separator"> · </span>
      <span className="detail__nowrap detail__accent">약 {trimDecimal(pyeongFromSqm(first), 1)}~{trimDecimal(pyeongFromSqm(last), 1)}평</span>
    </>
  );
}

function PriceValue({ notice }: { notice: Notice }) {
  const { priceMin, priceMax } = notice;
  if (priceMin == null && priceMax == null) return null;
  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return (
      <>
        <span className="detail__nowrap">{formatManwon(priceMin)}</span>
        <span className="detail__muted-separator"> ~ </span>
        <span className="detail__nowrap">{formatManwon(priceMax)}</span>
      </>
    );
  }
  return <span className="detail__nowrap">{formatManwon(priceMax ?? priceMin!)}</span>;
}

function sumKnown(values: Array<number | undefined>): number | undefined {
  const known = values.filter((value): value is number => value != null);
  return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : undefined;
}

export function DetailScreen({ notices, subscriptions, loading, error }: Props) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const now = useNow(15_000);
  const [permission, setPermission] = useState<PermissionState>(() => notificationSupport());
  const [mapOpen, setMapOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const mapSheetRef = useRef<HTMLElement>(null);
  const mapTriggerRef = useRef<HTMLButtonElement>(null);
  const openedNoticeId = useRef<string | null>(null);
  const notice = notices.find((item) => item.id === id);

  useEffect(() => {
    if (!notice || openedNoticeId.current === notice.id) return;
    openedNoticeId.current = notice.id;
    void trackFamilyEvent("notice_opened", "notice-detail");
  }, [notice]);

  useEffect(() => {
    if (!notice || location.hash !== "#alerts") return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById("alerts");
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: "auto", block: "center" });
      root.style.scrollBehavior = previousScrollBehavior;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, notice]);

  useEffect(() => {
    if (!mapOpen) return;
    const sheet = mapSheetRef.current;
    const focusable = sheet?.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
    focusable?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMapOpen(false);
        window.requestAnimationFrame(() => mapTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mapOpen]);

  if (!notice) {
    return (
      <div className="screen">
        <div className="empty">
          <p className="empty__title">{loading ? "공고를 불러오는 중입니다…" : error ? "공고 연결이 지연되고 있어요" : "공고를 찾을 수 없어요"}</p>
          {error && !loading && <p className="empty__body">{error}</p>}
          <Link to="/" className="btn btn--ghost">목록으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const status = getNoticeStatus(notice, now);
  const closingSoon = isClosingSoon(notice, now);
  const { subs, isSubscribed, subscribe, unsubscribe, toggleOffset } = subscriptions;
  const entry = subs[notice.id];
  const subscribed = isSubscribed(notice.id);
  const finished = status === "마감" || status === "취소";
  const schedule = noticeSchedule(notice).filter((item) => item.kind !== "announce");
  const areas = modelAreas(notice);
  const decision = notice.decisionSupport;
  const priceSignal = notice.priceSignal?.confidence === "high"
    && notice.priceSignal.source === "molit-trade"
    && notice.priceSignal.percentBelowMedian > 0
    && notice.priceSignal.sampleMonths > 0
    ? notice.priceSignal
    : undefined;
  const mapCandidates = addressSearchCandidates(notice.address, notice.houseName, notice.region);
  const coordinateUrl = notice.latitude != null && notice.longitude != null
    ? `https://map.kakao.com/link/map/${encodeURIComponent(notice.houseName)},${notice.latitude},${notice.longitude}`
    : null;
  const housingCategory = inferHousingCategory(notice.housingCategory, notice.sourceOperation);
  const targetIso = status === "접수중" ? notice.receiptEnd : notice.receiptStart;
  const targetDday = ddayKst(targetIso, now);
  const deadlineBadge = status === "취소"
    ? "공고 취소"
    : status === "마감"
      ? "접수 마감"
      : status === "접수중"
        ? targetDday === 0 ? "오늘 마감 D-0" : `마감 D-${targetDday}`
        : targetDday === 0 ? "오늘 시작 D-0" : `시작 D-${targetDday}`;
  const generalSupply = sumKnown((notice.modelSummaries ?? []).map((model) => model.supplyCount));
  const specialSupply = sumKnown((notice.modelSummaries ?? []).map((model) => model.specialSupplyCount));
  const houseTypes = Array.from(new Set((notice.modelSummaries ?? [])
    .map((model) => model.houseType?.trim())
    .filter((value): value is string => Boolean(value))));
  const receiptEvent = notice.events?.find((item) => ["receipt", "special", "rank1", "rank2", "no-priority"].includes(item.kind));
  const targetTimeConfirmed = status === "접수중" ? receiptEvent?.endTimeConfirmed === true : receiptEvent?.startTimeConfirmed === true;
  const hasEligibility = Boolean(
    decision?.subscriptionAccount
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

  const enableAlert = () => {
    subscribe(notice);
    void trackFamilyEvent("alert_enabled", "notice-detail");
  };

  const onMasterToggle = async () => {
    if (subscribed) {
      unsubscribe(notice.id);
      return;
    }
    const nextPermission = permission === "default" ? await requestPermission() : permission;
    setPermission(nextPermission);
    if (nextPermission === "granted") enableAlert();
  };

  const onOffset = (kind: Exclude<AlertKind, "event">, off: number) => {
    if (!subscribed) return;
    toggleOffset(notice.id, kind, off);
  };

  const closeMap = () => {
    setMapOpen(false);
    window.requestAnimationFrame(() => mapTriggerRef.current?.focus());
  };

  const copyAddress = async (candidate: string) => {
    try {
      await navigator.clipboard.writeText(candidate);
      setCopyStatus("주소를 복사했습니다.");
    } catch {
      setCopyStatus("주소 복사에 실패했습니다.");
    }
  };

  const openMap = () => {
    setCopyStatus("");
    setMapOpen(true);
  };

  const scrollToAlerts = () => {
    document.getElementById("alerts")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="screen detail-screen">
      <button className="back" onClick={() => navigate(-1)}>← 목록</button>

      {status === "취소" && (
        <div className="notice-bar">이 공고는 취소되었습니다. 청약홈에서 취소 공고를 확인하세요.</div>
      )}
      {status !== "취소" && notice.missingFromFeed && (
        <div className="notice-bar" role="status">
          이 공고가 청약홈 목록에서 내려갔어요. 취소·정정 가능성이 있어 알림을 멈췄습니다. 청약홈 원문을 확인하세요.
          {subscribed && (
            <button type="button" className="notice-bar__action" onClick={() => unsubscribe(notice.id)}>알림 정리</button>
          )}
        </div>
      )}
      {notice.corrected && !finished && (
        <div className="notice-bar">정정 공고가 있었던 건입니다. 신청 전 최신 청약홈 원문을 확인하세요.</div>
      )}

      <article className="decision-card" aria-labelledby="decision-card-title">
        <header className="decision-card__deadline">
          <div>
            <span>{status === "접수중" ? "실시간 마감" : status === "예정" ? "접수 시작" : "접수 상태"}</span>
            {!finished && targetTimeConfirmed ? <Countdown targetIso={targetIso} /> : !finished ? <strong className="countdown__date">{formatKstDate(targetIso)}</strong> : <strong className="countdown__value">{status === "취소" ? "취소" : "마감"}</strong>}
          </div>
          <span className={`decision-card__dday${status === "접수중" && closingSoon ? " decision-card__dday--urgent" : ""}`}>{deadlineBadge}</span>
          <p>
            <b>접수기간</b>
            <span className="detail__nowrap">{targetTimeConfirmed ? formatKstDateTime(notice.receiptStart) : formatKstDate(notice.receiptStart)}</span>
            <span aria-hidden="true">~</span>
            <span className="detail__nowrap">{targetTimeConfirmed ? formatKstDateTime(notice.receiptEnd) : formatKstDate(notice.receiptEnd)}</span>
          </p>
        </header>

        <div className="decision-card__identity">
          <div className="detail__badges">
            <span className="badge badge--type">{notice.type}</span>
            {notice.supplyCount != null && <span className="badge badge--type"><span className="detail__nowrap">{notice.supplyCount.toLocaleString("ko-KR")}세대</span></span>}
            {decision?.selectionMethod && <span className="badge badge--open">{decision.selectionMethod}</span>}
            <StatusBadge status={status} />
            <CorrectionBadge corrected={notice.corrected} status={status} />
          </div>
          <h1 id="decision-card-title" className="detail__title">{notice.houseName}</h1>
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

        <a className="btn btn--primary btn--big decision-card__apply" href={notice.applyHomeUrl} target="_blank" rel="noreferrer" onClick={() => void trackFamilyEvent("official_apply_clicked", "notice-detail")}>
          {isApplyDeepLink ? (status === "접수중" ? "청약홈에서 신청" : "청약홈 접수처 열기") : "청약홈 열기"}
        </a>
        <div className="decision-card__secondary-actions">
          {!finished && <button type="button" onClick={scrollToAlerts}>{subscribed ? "알림 설정 보기" : "알림 설정"}</button>}
          {mapCandidates.length > 0 && <button ref={mapTriggerRef} type="button" onClick={openMap}>지도</button>}
        </div>

        <button
          className="decision-card__more"
          type="button"
          aria-expanded={moreOpen}
          aria-controls="decision-card-more"
          onClick={() => setMoreOpen((open) => !open)}
        >
          {moreOpen ? "접기" : "더 보기"}<span aria-hidden="true">{moreOpen ? "⌃" : "⌄"}</span>
        </button>

        {moreOpen && (
          <div id="decision-card-more" className="decision-card__more-content">
            {hasEligibility && <section className="decision-section" aria-labelledby="eligibility-title">
              <h2 id="eligibility-title">신청 자격·제약</h2>
              <div className="decision-section__pair">
                {decision?.subscriptionAccount && <div><span>청약통장</span><strong>{decision.subscriptionAccount}</strong></div>}
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

            {decision?.paymentSchedule?.length ? <section className="decision-section" aria-labelledby="payment-title">
              <h2 id="payment-title">납부 일정</h2>
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

            <section className="decision-section" aria-labelledby="schedule-title">
              <h2 id="schedule-title">청약 일정</h2>
              <ol className="decision-timeline">
                {schedule.map((item) => {
                  const start = formatKstDate(item.start);
                  const end = formatKstDate(item.end ?? item.start);
                  return (
                    <li key={item.id ?? `${item.kind}-${item.start}`}>
                      <span className={`schedule-dot schedule-dot--${item.kind}`} aria-hidden="true" />
                      <div><strong>{item.label}</strong><small>{start === end ? start : `${start} ~ ${end}`}</small></div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {hasSupplyComposition && <section className="decision-section" aria-labelledby="supply-title">
              <h2 id="supply-title">공급 구성</h2>
              <div className="decision-section__triple decision-section__triple--supply">
                {notice.supplyCount != null && <div><strong>{notice.supplyCount}</strong><span>총 모집</span></div>}
                {generalSupply != null && <div><strong>{generalSupply}</strong><span>일반공급</span></div>}
                {specialSupply != null && <div><strong>{specialSupply}</strong><span>특별공급</span></div>}
              </div>
            </section>}

            {hasComplexInfo && <section className="decision-section" aria-labelledby="complex-title">
              <h2 id="complex-title">단지 정보</h2>
              <dl className="decision-info">
                {areas.length > 0 && <InfoRow label="면적" value={<AreaValue areas={areas} />} />}
                {houseTypes.length > 0 && <InfoRow label="주택형" value={houseTypes.join(" · ")} />}
                {notice.moveInMonth && <InfoRow label="입주 예정" value={<span className="detail__nowrap">{notice.moveInMonth}</span>} />}
                {company && <InfoRow label="시행·시공" value={company} wide />}
                {notice.contactPhone && <InfoRow label="문의" value={<span className="detail__nowrap">{notice.contactPhone}</span>} />}
                <InfoRow label="공식 접수처" value={<a href={notice.applyHomeUrl} target="_blank" rel="noreferrer">청약홈</a>} wide />
                {notice.noticeUrl && <InfoRow label="모집공고 원문" value={<a href={notice.noticeUrl} target="_blank" rel="noreferrer">청약홈 공고문 열기</a>} wide />}
                {notice.totalHouseholdSourceUrl && <InfoRow label="단지 규모 출처" value={<a href={notice.totalHouseholdSourceUrl} target="_blank" rel="noreferrer">공개 확인 자료 열기</a>} wide />}
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

      {!finished && targetTimeConfirmed && (
        <section className="alerts-card" id="alerts" tabIndex={-1}>
          <div className="alerts-card__head">
            <h2>알림 받기</h2>
            <button
              className={`switch${subscribed ? " switch--on" : ""}`}
              role="switch"
              aria-checked={subscribed}
              aria-label={`${notice.houseName} 알림 ${subscribed ? "끄기" : "켜기"}`}
              onClick={() => void onMasterToggle()}
            >
              <span className="switch__knob" />
            </button>
          </div>
          <p className="alerts-card__hint">접수 시작일 <strong>{formatKstDateTime(notice.receiptStart)}</strong> 기준으로 예약합니다.</p>
          <PermissionBanner compact permission={permission} onPermissionChange={setPermission} onPermissionGranted={enableAlert} />
          {subscribed && entry && (
            <>
              <div className="alerts-card__group">
                <h3>접수 시작 <small>{formatKstDateTime(notice.receiptStart)}</small></h3>
                <div className="alerts-card__chips">
                  {DEFAULT_OPEN_OFFSETS.map((off) => (
                    <button key={off} className={`chip${entry.open.includes(off) ? " chip--active" : ""}`} aria-pressed={entry.open.includes(off)} onClick={() => onOffset("open", off)}>
                      {off === 0 ? "접수 시각" : `${offsetLabel(off)} 전`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="alerts-card__group">
                <h3>접수 마감</h3>
                <div className="alerts-card__chips">
                  {DEFAULT_CLOSE_OFFSETS.map((off) => (
                    <button key={off} className={`chip${entry.close.includes(off) ? " chip--active" : ""}`} aria-pressed={entry.close.includes(off)} onClick={() => onOffset("close", off)}>{`${offsetLabel(off)} 전`}</button>
                  ))}
                </div>
              </div>
              <p className="fineprint">이미 지난 시각의 알림은 예약되지 않아요.</p>
              <div className="alerts-card__group">
                <h3>세부 일정 <small>선택한 일정은 하루 전과 한 시간 전에 알려드려요.</small></h3>
                <div className="event-alerts">
                  {schedule.filter((item) => item.id && item.startTimeConfirmed === true && ["special", "rank1", "rank2", "no-priority", "winner", "contract"].includes(item.kind)).map((item) => (
                    <label key={item.id}>
                      <input type="checkbox" checked={entry.eventIds?.includes(item.id!) ?? false} onChange={() => subscriptions.toggleEvent(notice.id, item.id!)} />
                      <span><strong>{item.label}</strong><small>{formatKstDate(item.start)}</small></span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {mapOpen && (
        <div className="sheet-backdrop" role="presentation" onClick={closeMap}>
          <section ref={mapSheetRef} className="map-sheet" role="dialog" aria-modal="true" aria-labelledby="map-sheet-title" aria-describedby="map-sheet-desc" onClick={(event) => event.stopPropagation()}>
            <div className="map-sheet__head"><h2 id="map-sheet-title">위치 확인</h2><button type="button" onClick={closeMap} aria-label="닫기">×</button></div>
            <p id="map-sheet-desc">공식 좌표가 있으면 바로 열고, 없으면 주소 후보를 골라 지도에서 확인하세요.</p>
            {coordinateUrl && <a className="map-sheet__coordinate" href={coordinateUrl} target="_blank" rel="noreferrer">확인된 좌표로 카카오맵 열기</a>}
            {mapCandidates.map((candidate) => (
              <div className="map-sheet__candidate" key={candidate}>
                <strong>{candidate}</strong>
                <span>
                  <a href={naverMapSearchUrl(candidate)} target="_blank" rel="noreferrer">네이버 지도</a>
                  <a href={kakaoMapSearchUrl(candidate)} target="_blank" rel="noreferrer">카카오맵</a>
                  <button type="button" onClick={() => void copyAddress(candidate)}>주소 복사</button>
                </span>
              </div>
            ))}
            <p className="map-sheet__toast" role="status" aria-live="polite">{copyStatus}</p>
          </section>
        </div>
      )}

      <p className="fineprint">청약 신청과 자격 확인은 청약홈 공식 사이트에서 직접 진행해야 합니다. 정정·취소로 일정이 바뀔 수 있으니 신청 전 최신 모집공고 원문을 확인하세요.</p>
    </div>
  );
}
