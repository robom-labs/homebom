// 목표 시각까지 남은 시간을 1초 간격의 시:분:초로 보여주는 카운트다운 숫자.
import { useNow } from "../hooks/useNow";

export function Countdown({ targetIso }: { targetIso: string }) {
  const now = useNow(1000);
  const seconds = Math.max(0, Math.floor((Date.parse(targetIso) - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const value = [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

  return <span className="countdown__value" aria-label={`${hours}시간 ${minutes}분 ${remainder}초 남음`}>{value}</span>;
}
