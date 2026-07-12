// 청약봄의 공통 앱바와 서비스 상태를 표시한다.
import type { ReactNode } from "react";
import type { NoticeSource } from "../hooks/useNotices";

type Props = {
  title?: string;
  source?: NoticeSource;
  action?: ReactNode;
  compact?: boolean;
};

export function AppHeader({ title = "청약봄", source, action, compact = false }: Props) {
  return (
    <header className={`appbar${compact ? " appbar--compact" : ""}`}>
      <div className="appbar__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="32" height="32">
          <path d="M7 27V7.5A2.5 2.5 0 0 1 9.5 5h13A2.5 2.5 0 0 1 25 7.5V27" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" />
          <path d="M11 10h3m4 0h3m-10 5h3m4 0h3m-10 5h3m4 0h3M14 27v-3.5h4V27" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      </div>
      <div className="appbar__copy">
        <h1 className="appbar__title">
          {title}
          {title === "청약봄" && <span className="appbar__dot" aria-hidden="true" />}
        </h1>
        {!compact && <p className="appbar__tagline">청약 일정, 한눈에</p>}
      </div>
      {(action || source) && (
        <div className="appbar__action">
          {action ??
            (source && (
            <span className={`source source--${source}`}>
              {source === "live" ? "공식" : "연결 필요"}
            </span>
            ))}
        </div>
      )}
    </header>
  );
}
