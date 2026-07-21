// 실공고를 불러와 로딩·연결없음·에러·비어있음·데이터 상태로 보여주고 공고별 관심·알림·링크를 조합한다.
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from "react-native-safe-area-context";
import { BrandHeader } from "./src/components/BrandHeader";
import { InterestControls } from "./src/components/InterestControls";
import { NoticeOverview } from "./src/components/NoticeOverview";
import { NoticeTimeline } from "./src/components/NoticeTimeline";
import type { NativeNotice } from "./src/domain/notice";
import { openOfficialApplyHome } from "./src/domain/officialLink";
import { IS_NOTICES_CONFIGURED, useNotices } from "./src/hooks/useNotices";
import {
  cancelNoticeNotifications,
  scheduleNoticeNotifications,
  type NotificationScheduleResult,
} from "./src/notifications/noticeNotifications";
import { loadInterest, removeInterest, saveInterest } from "./src/storage/interests";
import { colors } from "./src/theme";

type InterestEntry = { interested: boolean; busy: boolean; feedback: string | null };
const EMPTY_ENTRY: InterestEntry = { interested: false, busy: false, feedback: null };

function scheduleFeedback(result: NotificationScheduleResult): string {
  switch (result.kind) {
    case "scheduled":
      return `관심 공고로 저장하고 남은 일정 ${result.notificationIds.length}개를 기기에 예약했습니다.`;
    case "partial":
      return `관심 공고는 저장했습니다. 알림 ${result.notificationIds.length}개를 예약했고 ${result.failedCount}개는 기기에서 예약하지 못했습니다.`;
    case "permission-denied":
      return "관심 공고로 저장했습니다. 알림 권한이 허용되지 않아 예약은 건너뛰었지만 나머지 기능은 그대로 사용할 수 있습니다.";
    case "no-upcoming":
      return "관심 공고로 저장했습니다. 앞으로 남은 알림 일정이 없습니다.";
    case "unavailable":
      return "관심 공고로 저장했습니다. 이 기기에서는 알림을 준비하지 못했지만 나머지 기능은 그대로 사용할 수 있습니다.";
  }
}

export function App() {
  const { notices, source, error, loading, reload } = useNotices();
  const [interest, setInterest] = useState<Record<string, InterestEntry>>({});
  const [ready, setReady] = useState(false);

  // 공고 목록이 준비되면 각 공고의 저장된 관심 여부를 한 번에 읽어 초기 상태를 만든다.
  useEffect(() => {
    if (loading) {
      setReady(false);
      return;
    }
    let active = true;
    setReady(false);
    void Promise.all(notices.map((notice) => loadInterest(notice.id))).then((records) => {
      if (!active) return;
      const next: Record<string, InterestEntry> = {};
      notices.forEach((notice, index) => {
        next[notice.id] = { interested: Boolean(records[index]), busy: false, feedback: null };
      });
      setInterest(next);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [loading, notices]);

  function patchEntry(id: string, partial: Partial<InterestEntry>): void {
    setInterest((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ENTRY), ...partial } }));
  }

  async function handleSchedule(notice: NativeNotice): Promise<void> {
    patchEntry(notice.id, { busy: true, feedback: null });

    const previous = await loadInterest(notice.id);
    await cancelNoticeNotifications(previous?.notificationIds ?? []);
    const result = await scheduleNoticeNotifications(notice);
    const notificationsStored = await saveInterest(notice.id, result.notificationIds);

    if (!notificationsStored) {
      await cancelNoticeNotifications(result.notificationIds);
    }
    const storageSuffix = notificationsStored
      ? ""
      : " 기기 관심 목록 저장을 완료하지 못해 새 예약은 정리했지만 앱은 계속 사용할 수 있습니다.";

    patchEntry(notice.id, { interested: true, busy: false, feedback: `${scheduleFeedback(result)}${storageSuffix}` });
  }

  async function handleRemove(notice: NativeNotice): Promise<void> {
    patchEntry(notice.id, { busy: true });
    const current = await loadInterest(notice.id);
    await cancelNoticeNotifications(current?.notificationIds ?? []);
    const removed = await removeInterest(notice.id);
    patchEntry(notice.id, {
      interested: false,
      busy: false,
      feedback: removed
        ? "관심 공고와 예약된 로컬 알림을 해제했습니다."
        : "화면에서는 관심을 해제했습니다. 기기 저장소 정리는 완료하지 못했습니다.",
    });
  }

  async function handleOpenOfficial(notice: NativeNotice): Promise<void> {
    patchEntry(notice.id, { feedback: "청약홈 공식 페이지를 엽니다." });
    const opened = await openOfficialApplyHome(notice.officialUrl);
    if (!opened) {
      patchEntry(notice.id, { feedback: "청약홈을 열지 못했습니다. 네트워크와 기본 브라우저 설정을 확인해 주세요." });
    }
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={styles.safeArea} edges={["top", "right", "bottom", "left"]}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          <BrandHeader />
          {loading ? (
            <StatusCard>
              <ActivityIndicator color={colors.accentDeep} />
              <Text style={styles.statusTitle}>실공고를 불러오는 중</Text>
              <Text style={styles.statusBody}>공식 청약홈 데이터를 확인하고 있습니다. 잠시만 기다려 주세요.</Text>
            </StatusCard>
          ) : source === "not-connected" && !IS_NOTICES_CONFIGURED ? (
            <StatusCard>
              <Text style={styles.statusTitle}>실공고 연결 준비 중</Text>
              <Text style={styles.statusBody}>{error ?? "실공고 연결이 아직 완료되지 않았습니다."}</Text>
              <RetryButton onPress={() => void reload()} />
            </StatusCard>
          ) : source === "not-connected" ? (
            <StatusCard>
              <Text style={styles.statusTitle}>실공고를 불러오지 못했습니다</Text>
              <Text style={styles.statusBody}>{error ?? "잠시 후 다시 시도해 주세요."}</Text>
              <RetryButton onPress={() => void reload()} />
            </StatusCard>
          ) : notices.length === 0 ? (
            <StatusCard>
              <Text style={styles.statusTitle}>현재 접수 가능한 공고가 없습니다</Text>
              <Text style={styles.statusBody}>지금은 접수 중인 공고가 없습니다. 새 공고가 열리면 이곳에서 확인할 수 있습니다.</Text>
              <RetryButton onPress={() => void reload()} />
            </StatusCard>
          ) : (
            <View>
              {source === "stale" && (
                <View style={styles.staleBanner}>
                  <Text style={styles.staleText}>
                    {error ?? "이 기기에 저장된 마지막 확인본입니다. 신청 전 청약홈 공식 페이지에서 원문과 정정 여부를 확인해 주세요."}
                  </Text>
                </View>
              )}
              {notices.map((notice, index) => {
                const entry = interest[notice.id] ?? EMPTY_ENTRY;
                return (
                  <View key={notice.id} style={index > 0 && styles.noticeGap}>
                    <NoticeOverview notice={notice} />
                    <NoticeTimeline notice={notice} now={new Date()} />
                    <InterestControls
                      interested={entry.interested}
                      busy={entry.busy}
                      ready={ready}
                      feedback={entry.feedback}
                      onSchedule={() => void handleSchedule(notice)}
                      onRemove={() => void handleRemove(notice)}
                      onOpenOfficial={() => void handleOpenOfficial(notice)}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function StatusCard({ children }: { children: ReactNode }) {
  return <View style={styles.statusCard}>{children}</View>;
}

function RetryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="실공고 다시 불러오기"
      onPress={onPress}
      style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
    >
      <Text style={styles.retryLabel}>다시 시도</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  statusCard: {
    marginTop: 22,
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: 10,
  },
  statusTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  statusBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentDeep,
  },
  retryPressed: {
    opacity: 0.72,
  },
  retryLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  staleBanner: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.warningSoft,
  },
  staleText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  noticeGap: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
