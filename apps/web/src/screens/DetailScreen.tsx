// 공고 상세 화면. 카운트다운·알림 프리셋·청약홈 딥링크를 제공한다.
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Notice } from "@zoopzoopcall/core";
import {
  DEFAULT_CLOSE_OFFSETS,
  DEFAULT_OPEN_OFFSETS,
  formatKstDateTime,
  formatManwon,
  getNoticeStatus,
  isClosingSoon,
  offsetLabel,
  type AlertKind,
} from "@zoopzoopcall/core";
import { Countdown } from "../components/Countdown";
import { StatusBadge, TypeBadge } from "../components/StatusBadge";
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
    subscribe(notice.id);
  };

  const onOffset = (kind: AlertKind, off: number) => {
    if (!subscribed) return;
    toggleOffset(notice.id, kind, off);
  };

  const rows: Array<[string, string | undefined]> = [
    ["유형", notice.type],
    ["지역", notice.region],
    ["위치", notice.address],
    ["공급", notice.supplyCount ? `${notice.supplyCount}세대` : undefined],
    [
      "공급금액",
      notice.priceMin
        ? notice.priceMax
          ? `${formatManwon(notice.priceMin)} ~ ${formatManwon(notice.priceMax)}`
          : formatManwon(notice.priceMin)
        : undefined,
    ],
    ["모집공고일", notice.announceDate],
    ["접수 시작", formatKstDateTime(notice.receiptStart)],
    ["접수 마감", formatKstDateTime(notice.receiptEnd)],
    ["당첨자 발표", notice.winnerDate],
  ];

  return (
    <div className="screen">
      <button className="back" onClick={() => navigate(-1)}>
        ← 목록
      </button>

      <div className="detail__badges">
        <TypeBadge type={notice.type} />
        <StatusBadge status={status} />
        {notice.corrected && status !== "정정" && <span className="badge badge--warn">정정</span>}
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

      <a className="btn btn--primary btn--big" href={notice.applyHomeUrl} target="_blank" rel="noreferrer">
        청약홈에서 신청하기
      </a>
      <p className="fineprint">신청·자격 확인은 청약홈(applyhome.co.kr) 공식 사이트에서만 진행됩니다.</p>

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

      <p className="fineprint">
        출처: 한국부동산원 청약홈 분양정보. 정정·취소로 일정이 바뀔 수 있으니 신청 전 청약홈 원문을
        확인하세요.
      </p>
    </div>
  );
}
