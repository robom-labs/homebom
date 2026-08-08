// 저장 당시 공고와 최신 공고의 알림 내용·시각이 달라졌는지 결정적으로 판정한다.
import type { NativeNotice } from "./notice";

function notificationContract(notice: NativeNotice): string {
  return JSON.stringify({
    id: notice.id,
    title: notice.title,
    officialUrl: notice.officialUrl,
    milestones: [...notice.milestones]
      .sort((left, right) => left.kind.localeCompare(right.kind))
      .map((milestone) => ({
        kind: milestone.kind,
        label: milestone.label,
        startsAt: milestone.startsAt,
        endsAt: milestone.endsAt ?? null,
        notificationAt: milestone.notificationAt ?? null,
        nextAction: milestone.nextAction,
      })),
  });
}

export function noticeNotificationChanged(
  previous: NativeNotice | undefined,
  current: NativeNotice,
): boolean {
  return !previous || notificationContract(previous) !== notificationContract(current);
}
