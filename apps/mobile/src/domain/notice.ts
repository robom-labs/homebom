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

export type NativeNoticeDecisionSummary = {
  price?: string;
  area?: string;
  subscriptionAccount?: string;
  selectionMethod?: string;
  moveInMonth?: string;
  corrected?: boolean;
  verifiedAt: string;
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
  /** 0.16.0 이하에 저장된 관심 공고는 이 요약이 없을 수 있다. */
  decision?: NativeNoticeDecisionSummary;
  milestones: readonly NoticeMilestone[];
};

export type NoticeDeadlineSummary = {
  days: number | null;
  label: string;
  state: "upcoming" | "open" | "closed" | "unavailable";
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

const kstDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

function calendarDaysBetween(target: number, now: number): number | null {
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;
  const targetKey = kstDateKeyFormatter.format(new Date(target));
  const nowKey = kstDateKeyFormatter.format(new Date(now));
  const targetDay = Date.parse(`${targetKey}T00:00:00Z`);
  const nowDay = Date.parse(`${nowKey}T00:00:00Z`);
  if (!Number.isFinite(targetDay) || !Number.isFinite(nowDay)) return null;
  return Math.round((targetDay - nowDay) / 86_400_000);
}

/** 접수 시작·마감의 KST 날짜 경계를 기준으로 지금 가장 중요한 행동을 만든다. */
export function noticeDeadlineSummary(
  notice: NativeNotice,
  now = Date.now(),
): NoticeDeadlineSummary {
  const receipt = notice.milestones.find((milestone) => milestone.kind === "receipt");
  if (!receipt) return { days: null, label: "접수 일정 확인 필요", state: "unavailable" };
  const startsAt = Date.parse(receipt.startsAt);
  const endsAt = Date.parse(receipt.endsAt ?? receipt.startsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return { days: null, label: "접수 일정 확인 필요", state: "unavailable" };
  }
  if (now < startsAt) {
    const days = calendarDaysBetween(startsAt, now);
    return {
      days,
      label: days === 0 ? "오늘 접수 시작" : days == null ? "접수 예정" : `접수 시작 D-${days}`,
      state: "upcoming",
    };
  }
  if (now <= endsAt) {
    const days = calendarDaysBetween(endsAt, now);
    return {
      days,
      label: days === 0 ? "오늘 접수 마감" : days == null ? "접수 중" : `접수 마감 D-${days}`,
      state: "open",
    };
  }
  return { days: 0, label: "접수 마감", state: "closed" };
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
