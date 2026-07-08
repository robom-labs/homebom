// 목표 시각까지 남은 시간을 1초 간격으로 보여주는 카운트다운 숫자.
import { formatRemaining } from "@zoopzoopcall/core";
import { useNow } from "../hooks/useNow";

export function Countdown({ targetIso }: { targetIso: string }) {
  const now = useNow(1000);
  const ms = Date.parse(targetIso) - now;
  return <span className="countdown__value">{formatRemaining(ms, ms < 3600_000)}</span>;
}
