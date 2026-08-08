// 사용자 선택 뒤 권한을 요청하고 관심 공고의 로컬 일정 알림을 예약한다.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { formatMilestoneRange, type NativeNotice } from "../domain/notice";

const CHANNEL_ID = "homebom-schedule";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type NotificationScheduleResult =
  | { kind: "scheduled"; notificationIds: string[]; failedCount: 0 }
  | { kind: "partial"; notificationIds: string[]; failedCount: number }
  | { kind: "permission-denied" | "unavailable" | "no-upcoming"; notificationIds: []; failedCount: 0 };

function permissionAllowsNotifications(status: Notifications.NotificationPermissionsStatus): boolean {
  return status.granted
    || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    || status.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

async function ensurePermission(requestPermission: boolean): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "청약 일정",
      description: "관심 공고의 접수·발표·계약 일정을 알려드립니다.",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: "#4DA35E",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (permissionAllowsNotifications(current)) return true;
  if (!requestPermission) return false;

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return permissionAllowsNotifications(requested);
}

export async function cancelNoticeNotifications(notificationIds: readonly string[]): Promise<void> {
  await Promise.all(notificationIds.map(async (identifier) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {
      // 이미 사라졌거나 OS가 취소를 거부해도 관심 해제 흐름은 계속 진행한다.
    }
  }));
}

export async function scheduleNoticeNotifications(
  notice: NativeNotice,
  now = new Date(),
  options: { requestPermission?: boolean } = {},
): Promise<NotificationScheduleResult> {
  const upcoming = notice.milestones.filter((milestone) => (
    milestone.notificationAt && Date.parse(milestone.notificationAt) > now.getTime()
  ));
  if (upcoming.length === 0) {
    return { kind: "no-upcoming", notificationIds: [], failedCount: 0 };
  }

  try {
    if (!(await ensurePermission(options.requestPermission !== false))) {
      return { kind: "permission-denied", notificationIds: [], failedCount: 0 };
    }
  } catch {
    return { kind: "unavailable", notificationIds: [], failedCount: 0 };
  }

  const notificationIds: string[] = [];
  let failedCount = 0;

  for (const milestone of upcoming) {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        identifier: `homebom-native:${notice.id}:${milestone.kind}`,
        content: {
          title: `${notice.title} ${milestone.label} 일정`,
          body: `${formatMilestoneRange(milestone)}. ${milestone.nextAction}`,
          data: {
            noticeId: notice.id,
            milestone: milestone.kind,
            officialUrl: notice.officialUrl,
            appUrl: `homebom://notice/${encodeURIComponent(notice.id)}`,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(milestone.notificationAt as string),
          channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
        },
      });
      notificationIds.push(identifier);
    } catch {
      failedCount += 1;
    }
  }

  if (failedCount > 0) {
    return { kind: "partial", notificationIds, failedCount };
  }
  return { kind: "scheduled", notificationIds, failedCount: 0 };
}
