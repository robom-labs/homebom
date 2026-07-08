// 알림 권한 상태를 안내하고 허용을 유도하는 배너. 권한 없음은 숨기지 않고 크게 알린다.
import { useState } from "react";
import type { PermissionState } from "../notify/notifications";
import { notificationSupport, requestPermission } from "../notify/notifications";

export function PermissionBanner({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<PermissionState>(() => notificationSupport());

  if (state === "granted") return null;

  const ask = async () => {
    setState(await requestPermission());
  };

  if (state === "unsupported") {
    return (
      <div className={`perm perm--warn${compact ? " perm--compact" : ""}`}>
        <p className="perm__title">이 브라우저는 알림을 지원하지 않아요</p>
        {!compact && (
          <p className="perm__body">
            안드로이드는 크롬을 권장합니다. 아이폰은 사파리에서 공유 → 홈 화면에 추가 후, 추가된
            줍줍콜 아이콘으로 열어야 알림을 받을 수 있어요.
          </p>
        )}
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={`perm perm--warn${compact ? " perm--compact" : ""}`}>
        <p className="perm__title">알림이 차단되어 있어요</p>
        <p className="perm__body">
          브라우저 설정(주소창 자물쇠 → 알림)에서 이 사이트의 알림을 허용해 주세요. 허용해야 접수
          시작·마감을 알려드릴 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className={`perm${compact ? " perm--compact" : ""}`}>
      <div className="perm__text">
        <p className="perm__title">알림을 켜야 접수 순간을 알려드려요</p>
        {!compact && <p className="perm__body">접수 시작·마감 전에 폰으로 울려드립니다.</p>}
      </div>
      <button className="btn btn--primary btn--sm" onClick={() => void ask()}>
        알림 허용
      </button>
    </div>
  );
}
