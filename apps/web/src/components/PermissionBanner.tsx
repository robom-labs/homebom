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
          <p className="perm__body">안드로이드는 크롬, 아이폰은 사파리 홈 화면 앱 실행을 권장합니다.</p>
        )}
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={`perm perm--warn${compact ? " perm--compact" : ""}`}>
        <p className="perm__title">알림이 차단되어 있어요</p>
        <p className="perm__body">
          브라우저 설정에서 이 사이트의 알림을 허용해 주세요. 앱이 실행 중일 때 접수 시작·마감 알림을
          받을 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={`perm${compact ? " perm--compact" : ""}`}>
      <div className="perm__text">
        <p className="perm__title">알림을 켜면 접수 시간을 더 쉽게 챙길 수 있어요</p>
        {!compact && <p className="perm__body">앱이 실행 중일 때 접수 시작·마감 알림을 받을 수 있습니다.</p>}
      </div>
      <button className="btn btn--primary btn--sm" onClick={() => void ask()}>
        알림 허용
      </button>
    </div>
  );
}
