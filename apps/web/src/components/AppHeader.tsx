// 청약봄의 공통 앱바와 서비스 상태를 표시한다.
import type { ReactNode } from "react";
import type { NoticeSource } from "../hooks/useNotices";

// 로봄 패밀리 공통 "봄" 마크. 인라인 SVG라 base 경로에 무관하고, 봄 획은 currentColor로
// 라이트/다크 글자색을 따르며, 꽃만 패밀리 톤(청약=금)을 쓴다.
const BOM_PETAL =
  "M0 -1.4 C -4.6 -1.8 -6 -6.2 -3.7 -9.2 C -2.5 -10.7 -1.2 -9.4 0 -7.7 C 1.2 -9.4 2.5 -10.7 3.7 -9.2 C 6 -6.2 4.6 -1.8 0 -1.4 Z";
const BOM_GOLD = "#d99a1f";
const BOM_DRIFT: readonly [number, number, number, number][] = [
  [96, 58, 15, 1],
  [120, 52, -20, 1.1],
  [164, 46, 50, 1.3],
  [172, 62, 80, 1.1],
];

function BomMark() {
  return (
    <svg className="appbar__bom" viewBox="0 0 200 120" role="img" aria-label="봄">
      <g fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 8 L28 46" />
        <path d="M72 8 L72 46" />
        <path d="M28 28 L72 28" />
        <path d="M28 46 L72 46" />
        <path d="M10 64 L142 64" />
        <path d="M50 64 L50 47" />
        <path d="M28 76 L72 76 L72 110 L28 110 Z" />
      </g>
      <g transform="translate(148 60) scale(1.8)">
        {[-2, 74, 142, 218, 286].map((r) => (
          <path key={r} d={BOM_PETAL} fill={BOM_GOLD} transform={`rotate(${r})`} />
        ))}
        <circle r={2.4} fill="var(--surface)" />
        <circle r={1.2} fill={BOM_GOLD} opacity={0.5} />
      </g>
      {BOM_DRIFT.map(([x, y, rot, sc]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${rot}) scale(${sc})`}>
          <path d={BOM_PETAL} fill={BOM_GOLD} />
        </g>
      ))}
    </svg>
  );
}

type Props = {
  title?: string;
  source?: NoticeSource;
  action?: ReactNode;
  compact?: boolean;
};

export function AppHeader({ title = "청약봄", source, action, compact = false }: Props) {
  const iconUrl = `${import.meta.env.BASE_URL}icons/icon-v2.svg`;

  return (
    <header className={`appbar${compact ? " appbar--compact" : ""}`}>
      <div className="appbar__mark" aria-hidden="true">
        <img className="appbar__icon" src={iconUrl} alt="" />
      </div>
      <div className="appbar__copy">
        <h1 className="appbar__title">
          {title === "청약봄" ? (
            <span className="appbar__wordmark">청약<BomMark /></span>
          ) : (
            title
          )}
        </h1>
        {!compact && <p className="appbar__tagline">청약 일정, 한눈에</p>}
      </div>
      {(action || source) && (
        <div className="appbar__action">
          {action ??
            (source && (
            <span className={`source source--${source}`}>
              {source === "live" ? "공식" : source === "stale" ? "확인 지연" : "연결 필요"}
            </span>
            ))}
        </div>
      )}
    </header>
  );
}
