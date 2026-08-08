// 네이티브 공고 일정과 다음 행동을 표현하는 도메인 타입과 순수함수다.
export type MilestoneKind = "announcement" | "receipt" | "winner" | "contract";

export type NoticeMilestone = {
  kind: MilestoneKind;
  label: string;
  startsAt: string;
  endsAt?: string;
  nextAction: string;
  notificationAt?: string;
};

export type NativeNotice = {
  id: string;
  manageNo: string;
  pblancNo: string;
  title: string;
  category: string;
  region: string;
  address: string;
  supplyCount: number | null;
  sourceLabel: string;
  officialUrl: string;
  milestones: readonly NoticeMilestone[];
};

export type TimelineState = "completed" | "next" | "upcoming";

export type TimelineItem = NoticeMilestone & {
  state: TimelineState;
  isInProgress: boolean;
};

function milestoneEnd(milestone: NoticeMilestone): number {
  return Date.parse(milestone.endsAt ?? milestone.startsAt);
}

export function buildTimeline(notice: NativeNotice, now: Date): TimelineItem[] {
  const nowTime = now.getTime();
  const nextIndex = notice.milestones.findIndex((milestone) => milestoneEnd(milestone) >= nowTime);

  return notice.milestones.map((milestone, index) => ({
    ...milestone,
    state: milestoneEnd(milestone) < nowTime
      ? "completed"
      : index === nextIndex
        ? "next"
        : "upcoming",
    isInProgress: Date.parse(milestone.startsAt) <= nowTime && milestoneEnd(milestone) >= nowTime,
  }));
}

export function getNextMilestone(notice: NativeNotice, now: Date): TimelineItem | undefined {
  return buildTimeline(notice, now).find((milestone) => milestone.state === "next");
}

const kstDateTime = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

export function formatMilestoneRange(milestone: NoticeMilestone): string {
  const start = kstDateTime.format(new Date(milestone.startsAt));
  if (!milestone.endsAt) return start;
  return `${start} ~ ${kstDateTime.format(new Date(milestone.endsAt))}`;
}
