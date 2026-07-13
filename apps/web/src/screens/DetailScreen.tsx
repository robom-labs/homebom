// 공고 상세 화면. 카운트다운·알림 프리셋·청약홈 딥링크를 제공한다.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import {
  DEFAULT_CLOSE_OFFSETS,
  DEFAULT_OPEN_OFFSETS,
  formatArea,
  formatHouseTypeLabel,
  formatKstDate,
  formatKstDateTime,
  formatManwon,
  formatPriceRange,
  getNoticeStatus,
  inferHousingCategory,
  isClosingSoon,
  offsetLabel,
  addressSearchCandidates,
  kakaoMapSearchUrl,
  naverMapSearchUrl,
  type AlertKind,
} from "@zoopzoopcall/core";
import { Countdown } from "../components/Countdown";
import { CorrectionBadge, StatusBadge, TypeBadge } from "../components/StatusBadge";
import { PermissionBanner } from "../components/PermissionBanner";
import { useNow } from "../hooks/useNow";
import {
  notificationSupport,
  requestPermission,
  type PermissionState,
} from "../notify/notifications";
import type { useSubscriptions } from "../hooks/useSubscriptions";
import { noticeSchedule } from "../components/noticeSchedule";
import { specialSupplyEntries } from "../components/specialSupply";

type Props = {
  notices: Notice[];
  subscriptions: ReturnType<typeof useSubscriptions>;
};

export function DetailScreen({ notices, subscriptions }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const now = useNow(15_000);
  const [permission, setPermission] = useState<PermissionState>(() => notificationSupport());
  const [mapOpen, setMapOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const mapSheetRef = useRef<HTMLElement>(null);
  const mapTriggerRef = useRef<HTMLButtonElement>(null);
  const notice = notices.find((n) => n.id === id);

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
          <p className="empty__title">공고를 찾을 수 없어요</p>
          <Link to="/" className="btn btn--ghost">
            목록으로 돌아가기
          </Link>
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

  const onMasterToggle = async () => {
    if (subscribed) {
      unsubscribe(notice.id);
      return;
    }
    const nextPermission = permission === "default" ? await requestPermission() : permission;
    setPermission(nextPermission);
    if (nextPermission === "granted") subscribe(notice);
  };

  const onOffset = (kind: Exclude<AlertKind, "event">, off: number) => {
    if (!subscribed) return;
    toggleOffset(notice.id, kind, off);
  };

  const housingCategory = inferHousingCategory(notice.housingCategory, notice.sourceOperation);
  const receiptStartLabel = formatKstDateTime(notice.receiptStart);
  const schedule = noticeSchedule(notice);
  const mapCandidates = addressSearchCandidates(notice.address, notice.houseName, notice.region);
  const coordinateUrl = notice.latitude != null && notice.longitude != null
    ? `https://map.kakao.com/link/map/${encodeURIComponent(notice.houseName)},${notice.latitude},${notice.longitude}`
    : null;
  const modelStatus = notice.modelDataStatus === "collected"
    ? "주택형 정보 확인 완료"
    : notice.modelDataStatus === "retrying"
      ? "호출 제한으로 잠시 후 재시도"
      : "주택형 정보 수집 중 또는 공고문 확인";
  const rows: Array<[string, string | undefined]> = [
    ["청약 유형", notice.type],
    ["주택 형태", housingCategory],
    ["지역", notice.region],
    ["위치", notice.address],
    ["우편번호", notice.zipCode],
    ["단지 전체", notice.totalHouseholdCount != null ? `${notice.totalHouseholdCount.toLocaleString("ko-KR")}세대` : "공고문 확인"],
    ["이번 모집", notice.supplyCount != null ? `${notice.supplyCount.toLocaleString("ko-KR")}세대` : "공고문 확인"],
    ["분양가", formatPriceRange(notice) ?? "공고문 확인"],
    ["모집공고일", notice.announceDate],
    ["접수 시작", formatKstDateTime(notice.receiptStart)],
    ["접수 마감", formatKstDateTime(notice.receiptEnd)],
    ["당첨자 발표", notice.winnerDate],
    ["계약기간", notice.contractStartDate && notice.contractEndDate ? `${notice.contractStartDate} ~ ${notice.contractEndDate}` : undefined],
    ["입주예정", notice.moveInMonth],
    ["시행사", notice.businessOwnerName],
    ["문의처", notice.contactPhone],
    ["신문사", notice.newspaperName],
  ];

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

  return (
    <div className="screen">
      <button className="back" onClick={() => navigate(-1)}>
        ← 목록
      </button>

      <div className="detail__badges">
        <TypeBadge type={notice.type} />
        <StatusBadge status={status} />
        <CorrectionBadge corrected={notice.corrected} status={status} />
      </div>
      <h1 className="detail__title">{notice.houseName}</h1>

      {status === "취소" && (
        <div className="notice-bar">이 공고는 취소되었습니다. 청약홈에서 취소 공고를 확인하세요.</div>
      )}
      {notice.corrected && !finished && (
        <div className="notice-bar">
          정정 공고가 있었던 건입니다. 접수 일정이 바뀌었을 수 있으니 청약홈 원문을 꼭 확인하세요.
        </div>
      )}

      {!finished && (
        <div className={`countdown${status === "접수중" && closingSoon ? " countdown--urgent" : ""}`}>
          <p className="countdown__label">
            {status === "접수중" ? "마감까지 남은 시간" : "접수 시작까지 남은 시간"}
          </p>
          <Countdown targetIso={status === "접수중" ? notice.receiptEnd : notice.receiptStart} />
        </div>
      )}

      {notice.noticeUrl && (
        <div className="detail__actions">
          <a className="btn btn--primary btn--big" href={notice.noticeUrl} target="_blank" rel="noreferrer">
            모집공고 원문 보기
          </a>
        </div>
      )}

      {!finished && (
        <section className="alerts-card" id="alerts">
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
          <p className="alerts-card__hint">
            접수 시작일 <strong>{receiptStartLabel}</strong> 기준으로 예약합니다.
          </p>
          <PermissionBanner
            compact
            permission={permission}
            onPermissionChange={setPermission}
            onPermissionGranted={() => subscribe(notice)}
          />
          {subscribed && entry && (
            <>
              <div className="alerts-card__group">
                <h3>접수 시작 <small>{receiptStartLabel}</small></h3>
                <div className="alerts-card__chips">
                  {DEFAULT_OPEN_OFFSETS.map((off) => (
                    <button
                      key={off}
                      className={`chip${entry.open.includes(off) ? " chip--active" : ""}`}
                      aria-pressed={entry.open.includes(off)}
                      onClick={() => onOffset("open", off)}
                    >
                      {off === 0 ? "접수 시각" : `${offsetLabel(off)} 전`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="alerts-card__group">
                <h3>접수 마감</h3>
                <div className="alerts-card__chips">
                  {DEFAULT_CLOSE_OFFSETS.map((off) => (
                    <button
                      key={off}
                      className={`chip${entry.close.includes(off) ? " chip--active" : ""}`}
                      aria-pressed={entry.close.includes(off)}
                      onClick={() => onOffset("close", off)}
                    >
                      {`${offsetLabel(off)} 전`}
                    </button>
                  ))}
                </div>
              </div>
              <p className="fineprint">이미 지난 시각의 알림은 예약되지 않아요.</p>
              <div className="alerts-card__group">
                <h3>세부 일정 <small>선택한 일정은 하루 전과 한 시간 전에 알려드려요.</small></h3>
                <div className="event-alerts">
                  {schedule.filter((item) => item.id && ["special", "rank1", "rank2", "no-priority", "winner", "contract"].includes(item.kind)).map((item) => (
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

      <div className="detail__actions detail__actions--secondary">
        <a className="btn btn--ghost btn--big" href={notice.applyHomeUrl} target="_blank" rel="noreferrer">
          청약홈으로 이동
        </a>
        {notice.officialHomepageUrl && (
          <a className="btn btn--ghost btn--big" href={notice.officialHomepageUrl} target="_blank" rel="noreferrer">
            공식 홈페이지 보기
          </a>
        )}
        {mapCandidates.length > 0 && (
          <button ref={mapTriggerRef} className="btn btn--ghost btn--big" type="button" onClick={() => { setCopyStatus(""); setMapOpen(true); }}>
            지도 검색 선택
          </button>
        )}
        {notice.totalHouseholdSourceUrl && (
          <a className="btn btn--ghost btn--big" href={notice.totalHouseholdSourceUrl} target="_blank" rel="noreferrer">
            단지 규모 출처 보기
          </a>
        )}
      </div>
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
      <p className="fineprint">
        청약 신청과 자격 확인은 청약홈 공식 사이트에서 직접 진행해야 합니다. 접수 가능 시간은 영업일
        09:00~17:30 기준이며, 공고별 별도 조건과 정정 여부는 모집공고 원문을 확인하세요.
      </p>

      <section className="detail__table">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div className="detail__row" key={k}>
              <span className="detail__key">{k}</span>
              <span className="detail__val">{v}</span>
            </div>
          ))}
      </section>

      <section className="detail__schedule" aria-labelledby="detail-schedule-title">
        <h2 id="detail-schedule-title">청약 전체 일정</h2>
        <p>접수뿐 아니라 발표와 계약까지 한 번에 확인하세요.</p>
        <ol>
          {schedule.map((item) => {
            const start = formatKstDate(item.start);
            const end = formatKstDate(item.end ?? item.start);
            return (
              <li key={`${item.kind}-${item.label}-${item.start}`}>
                <span className={`schedule-dot schedule-dot--${item.kind}`} aria-hidden="true" />
                <div><strong>{item.label}</strong><small>{start === end ? start : `${start} ~ ${end}`}</small></div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="detail__models">
          <h2>주택형·분양가</h2>
          <p className={`model-status model-status--${notice.modelDataStatus ?? "not-collected"}`}>{modelStatus}</p>
          {notice.modelSummaries && notice.modelSummaries.length > 0 ? notice.modelSummaries.map((model) => {
            const specialEntries = specialSupplyEntries(model);
            return (
            <div className="model-row" key={`${model.modelNo ?? ""}-${model.houseType ?? ""}`}>
              <div>
                <strong>{formatHouseTypeLabel(model.houseType) ?? "주택형 확인"}</strong>
                <span>{formatArea(model.supplyArea) ? `공급면적 ${formatArea(model.supplyArea)}` : "공급면적 공고문 확인"}</span>
              </div>
              <div>
                <span>
                  {model.supplyCount != null ? `일반 ${model.supplyCount}세대` : "일반공급 확인 필요"}
                  {model.specialSupplyCount != null ? ` · 특별 ${model.specialSupplyCount}세대` : ""}
                </span>
                {model.specialSupply && <ul className="model-row__special">{specialEntries.length > 0 ? specialEntries.map((item) => <li key={item.key}><span>{item.label}</span><strong>{item.count}세대</strong></li>) : <li>특별공급 세부 필드 없음</li>}</ul>}
                <strong>{model.priceMax ? formatManwon(model.priceMax) : "금액 확인 필요"}</strong>
              </div>
            </div>
          );
          }) : <p className="model-empty">세부 주택형과 공급량은 모집공고 원문에서 확인해 주세요.</p>}
          <p className="model-disclaimer">표시된 특별공급 세대수는 공급량이며 개인의 청약 자격을 판정하지 않습니다.</p>
        </section>

      <p className="fineprint">
        출처: 한국부동산원 청약홈 분양정보. 정정·취소로 일정이 바뀔 수 있으니 신청 전 모집공고 원문과
        청약홈을 함께 확인하세요.
      </p>
    </div>
  );
}
