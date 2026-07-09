// 공고 상세 화면. 카운트다운·알림 프리셋·청약홈 딥링크를 제공한다.
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import {
  DEFAULT_CLOSE_OFFSETS,
  DEFAULT_OPEN_OFFSETS,
  formatKstDateTime,
  formatManwon,
  formatPriceRange,
  getNoticeStatus,
  isClosingSoon,
  offsetLabel,
  type AlertKind,
} from "@zoopzoopcall/core";
import { Countdown } from "../components/Countdown";
import { CorrectionBadge, StatusBadge, TypeBadge } from "../components/StatusBadge";
import { PermissionBanner } from "../components/PermissionBanner";
import { useNow } from "../hooks/useNow";
import { notificationSupport, requestPermission } from "../notify/notifications";
import type { useSubscriptions } from "../hooks/useSubscriptions";

type Props = {
  notices: Notice[];
  subscriptions: ReturnType<typeof useSubscriptions>;
};

export function DetailScreen({ notices, subscriptions }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const now = useNow(15_000);
  const notice = notices.find((n) => n.id === id);

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
    if (notificationSupport() === "default") await requestPermission();
    subscribe(notice);
  };

  const onOffset = (kind: AlertKind, off: number) => {
    if (!subscribed) return;
    toggleOffset(notice.id, kind, off);
  };

  const rows: Array<[string, string | undefined]> = [
    ["유형", notice.type],
    ["공식 구분", notice.officialTypeName],
    ["주택 분류", notice.housingCategory],
    ["지역", notice.region],
    ["위치", notice.address],
    ["우편번호", notice.zipCode],
    ["공급", notice.supplyCount ? `${notice.supplyCount}세대` : undefined],
    ["공급금액", formatPriceRange(notice) ?? "모집공고 원문 확인 필요"],
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

      <div className="detail__actions">
        {notice.noticeUrl && (
          <a className="btn btn--primary btn--big" href={notice.noticeUrl} target="_blank" rel="noreferrer">
            모집공고 원문 보기
          </a>
        )}
        <a className="btn btn--ghost btn--big" href={notice.applyHomeUrl} target="_blank" rel="noreferrer">
          청약홈으로 이동
        </a>
        {notice.officialHomepageUrl && (
          <a className="btn btn--ghost btn--big" href={notice.officialHomepageUrl} target="_blank" rel="noreferrer">
            공식 홈페이지 보기
          </a>
        )}
      </div>
      <p className="fineprint">
        청약 신청과 자격 확인은 청약홈 공식 사이트에서 직접 진행해야 합니다. 접수 가능 시간은 영업일
        09:00~17:30 기준이며, 공고별 별도 조건과 정정 여부는 모집공고 원문을 확인하세요.
      </p>

      {!finished && (
        <section className="alerts-card">
          <div className="alerts-card__head">
            <h2>알림 받기</h2>
            <button
              className={`switch${subscribed ? " switch--on" : ""}`}
              role="switch"
              aria-checked={subscribed}
              onClick={() => void onMasterToggle()}
            >
              <span className="switch__knob" />
            </button>
          </div>
          <PermissionBanner compact />
          {subscribed && entry && (
            <>
              <div className="alerts-card__group">
                <h3>접수 시작</h3>
                <div className="alerts-card__chips">
                  {DEFAULT_OPEN_OFFSETS.map((off) => (
                    <button
                      key={off}
                      className={`chip${entry.open.includes(off) ? " chip--active" : ""}`}
                      aria-pressed={entry.open.includes(off)}
                      onClick={() => onOffset("open", off)}
                    >
                      {off === 0 ? "정각" : `${offsetLabel(off)} 전`}
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
            </>
          )}
        </section>
      )}

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

      {notice.modelSummaries && notice.modelSummaries.length > 0 && (
        <section className="detail__models">
          <h2>주택형·금액</h2>
          {notice.modelSummaries.map((model) => (
            <div className="model-row" key={`${model.modelNo ?? ""}-${model.houseType ?? ""}`}>
              <div>
                <strong>{model.houseType ?? "주택형 확인 필요"}</strong>
                <span>{model.supplyArea ? `${model.supplyArea}㎡` : "면적 확인 필요"}</span>
              </div>
              <div>
                <span>
                  {model.supplyCount ? `일반 ${model.supplyCount}세대` : "일반공급 확인 필요"}
                  {model.specialSupplyCount ? ` · 특별 ${model.specialSupplyCount}세대` : ""}
                </span>
                <strong>{model.priceMax ? formatManwon(model.priceMax) : "금액 확인 필요"}</strong>
              </div>
            </div>
          ))}
        </section>
      )}

      <p className="fineprint">
        출처: 한국부동산원 청약홈 분양정보. 정정·취소로 일정이 바뀔 수 있으니 신청 전 모집공고 원문과
        청약홈을 함께 확인하세요.
      </p>
    </div>
  );
}
