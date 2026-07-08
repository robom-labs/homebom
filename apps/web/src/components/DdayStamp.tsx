// 공고 카드에 찍는 도장형 D-day 배지. 줍줍콜의 시그니처 요소다.
type Props = {
  label: string;
  tone: "red" | "ink" | "gray";
};

export function DdayStamp({ label, tone }: Props) {
  return <span className={`stamp stamp--${tone}`}>{label}</span>;
}
