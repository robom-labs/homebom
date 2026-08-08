// 실공고를 불러와 로딩·연결없음·에러·비어있음·데이터 상태로 보여주고 공고별 관심·알림·링크를 조합한다.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from "react-native-safe-area-context";
import { BrandHeader } from "./src/components/BrandHeader";
import { InterestControls } from "./src/components/InterestControls";
import { NoticeCalendar } from "./src/components/NoticeCalendar";
import { NoticeOverview } from "./src/components/NoticeOverview";
import { NoticeTimeline } from "./src/components/NoticeTimeline";
import type { NativeNotice } from "./src/domain/notice";
import {
  bringNoticeToFront,
  countNoticeDateFilters,
  countUpcomingReceiptStarts,
  discoverNotices,
  noticeDateFilterLabels,
  noticeDateFilters,
  noticeIdFromAppUrl,
  noticeIdFromNotificationData,
  type NoticeDateFilter,
} from "./src/domain/noticeDiscovery";
import { noticesForCalendarDate } from "./src/domain/noticeCalendar";
import { openOfficialApplyHome } from "./src/domain/officialLink";
import { noticeNotificationChanged } from "./src/domain/notificationRefresh";
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

function automaticScheduleFeedback(result: NotificationScheduleResult): string {
  switch (result.kind) {
    case "scheduled":
      return `공식 일정 변경을 반영해 남은 알림 ${result.notificationIds.length}개를 다시 맞췄습니다.`;
    case "partial":
      return `공식 일정은 갱신했습니다. 알림 ${result.notificationIds.length}개를 다시 맞췄고 ${result.failedCount}개는 기기에서 예약하지 못했습니다.`;
    case "permission-denied":
      return "공식 일정은 갱신했지만 알림 권한이 꺼져 새 알림은 예약하지 않았습니다.";
    case "no-upcoming":
      return "공식 일정은 갱신했고 앞으로 울릴 일정은 없습니다.";
    case "unavailable":
      return "공식 일정은 갱신했지만 이 기기에서 새 알림을 준비하지 못했습니다.";
  }
}

export function App() {
  const { notices, source, error, loading, refreshing, verifiedAt, reload } = useNotices();
  const scrollRef = useRef<ScrollView>(null);
  const [interest, setInterest] = useState<Record<string, InterestEntry>>({});
  const [ready, setReady] = useState(false);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<NoticeDateFilter>("all");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [interestedOnly, setInterestedOnly] = useState(false);
  const [focusedNoticeId, setFocusedNoticeId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<NativeNotice | null>(null);
  const [navigationFeedback, setNavigationFeedback] = useState<string | null>(null);

  const availableNotices = useMemo(() => (
    savedNotice && !notices.some((notice) => notice.id === savedNotice.id)
      ? [savedNotice, ...notices]
      : notices
  ), [notices, savedNotice]);

  const now = Date.now();
  const searchedNotices = discoverNotices(availableNotices, { filter: "all", query, now });
  const discoveredNotices = interestedOnly
    ? searchedNotices.filter((notice) => interest[notice.id]?.interested)
    : searchedNotices;
  const dateCounts = countNoticeDateFilters(discoveredNotices, now);
  const listNotices = discoverNotices(discoveredNotices, { filter: dateFilter, query: "", now });
  const calendarNotices = selectedCalendarDate
    ? noticesForCalendarDate(discoveredNotices, selectedCalendarDate)
    : [];
  const visibleNotices = bringNoticeToFront(
    viewMode === "list" ? listNotices : calendarNotices,
    focusedNoticeId,
  );
  const interestCount = Object.values(interest).filter((entry) => entry.interested).length;
  const upcomingReceiptCount = countUpcomingReceiptStarts(availableNotices, 14, now);

  const focusNotice = useCallback((noticeId: string) => {
    setFocusedNoticeId(noticeId);
    setExpandedNoticeId(noticeId);
    setDateFilter("all");
    setQuery("");
    setViewMode("list");
    setSelectedCalendarDate(null);
    setInterestedOnly(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useEffect(() => {
    let active = true;

    void Linking.getInitialURL().then((url) => {
      const noticeId = noticeIdFromAppUrl(url);
      if (active && noticeId) focusNotice(noticeId);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const noticeId = noticeIdFromNotificationData(response?.notification.request.content.data);
      if (!active || !noticeId) return;
      focusNotice(noticeId);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    });

    const urlSubscription = Linking.addEventListener("url", ({ url }) => {
      const noticeId = noticeIdFromAppUrl(url);
      if (noticeId) focusNotice(noticeId);
    });
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const noticeId = noticeIdFromNotificationData(response.notification.request.content.data);
      if (noticeId) focusNotice(noticeId);
    });

    return () => {
      active = false;
      urlSubscription.remove();
      notificationSubscription.remove();
    };
  }, [focusNotice]);

  // 현재 활성 피드에서 사라진 공고도 관심 저장 당시 확인본으로 발표·계약 일정을 복원한다.
  useEffect(() => {
    if (loading || !focusedNoticeId) return;
    const current = notices.find((notice) => notice.id === focusedNoticeId);
    if (current) {
      setSavedNotice(null);
      setNavigationFeedback("알림으로 연 공고를 목록 맨 위에 표시했습니다.");
      return;
    }

    let active = true;
    void loadInterest(focusedNoticeId).then((record) => {
      if (!active) return;
      if (record?.notice) {
        setSavedNotice(record.notice);
        setNavigationFeedback("접수 목록에서는 마감된 관심 공고의 저장된 일정입니다. 신청 전 청약홈 원문을 다시 확인해 주세요.");
        return;
      }
      setSavedNotice(null);
      setNavigationFeedback("알림 공고가 현재 목록과 기기 관심 저장본에 없습니다. 청약홈 공식 페이지에서 최신 상태를 확인해 주세요.");
    });
    return () => {
      active = false;
    };
  }, [focusedNoticeId, loading, notices]);

  // 공고 목록이 준비되면 각 공고의 저장된 관심 여부를 한 번에 읽어 초기 상태를 만든다.
  useEffect(() => {
    if (loading) {
      setReady(false);
      return;
    }
    let active = true;
    setReady(false);
    void Promise.all(availableNotices.map((notice) => loadInterest(notice.id))).then((records) => {
      if (!active) return;
      const next: Record<string, InterestEntry> = {};
      availableNotices.forEach((notice, index) => {
        next[notice.id] = { interested: Boolean(records[index]), busy: false, feedback: null };
      });
      setInterest(next);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [availableNotices, loading]);

  // 공식 일정이 바뀌면 기존 관심 공고의 로컬 알림도 최신 시각·문구로 맞춘다.
  // 자동 갱신에서는 권한 창을 띄우지 않고, 이미 허용된 기기에서만 다시 예약한다.
  useEffect(() => {
    if (loading || source !== "live") return;
    let active = true;
    void (async () => {
      const updates: Array<{ noticeId: string; feedback: string }> = [];
      for (const notice of notices) {
        const previous = await loadInterest(notice.id);
        if (!previous || !noticeNotificationChanged(previous.notice, notice)) continue;
        await cancelNoticeNotifications(previous.notificationIds);
        const result = await scheduleNoticeNotifications(notice, new Date(), { requestPermission: false });
        const stored = await saveInterest(notice, result.notificationIds);
        if (!stored) {
          await cancelNoticeNotifications(result.notificationIds);
          updates.push({
            noticeId: notice.id,
            feedback: "공식 일정 변경을 확인했지만 기기 저장소에 반영하지 못해 새 알림은 예약하지 않았습니다.",
          });
          continue;
        }
        updates.push({ noticeId: notice.id, feedback: automaticScheduleFeedback(result) });
      }
      if (!active || updates.length === 0) return;
      setInterest((current) => {
        const next = { ...current };
        for (const update of updates) {
          next[update.noticeId] = {
            ...(next[update.noticeId] ?? EMPTY_ENTRY),
            interested: true,
            busy: false,
            feedback: update.feedback,
          };
        }
        return next;
      });
    })();
    return () => {
      active = false;
    };
  }, [loading, notices, source]);

  function patchEntry(id: string, partial: Partial<InterestEntry>): void {
    setInterest((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ENTRY), ...partial } }));
  }

  async function handleSchedule(notice: NativeNotice): Promise<void> {
    patchEntry(notice.id, { busy: true, feedback: null });

    const previous = await loadInterest(notice.id);
    await cancelNoticeNotifications(previous?.notificationIds ?? []);
    const result = await scheduleNoticeNotifications(notice);
    const notificationsStored = await saveInterest(notice, result.notificationIds);

    if (!notificationsStored) {
      await cancelNoticeNotifications(result.notificationIds);
    }
    patchEntry(notice.id, {
      interested: notificationsStored,
      busy: false,
      feedback: notificationsStored
        ? scheduleFeedback(result)
        : "기기 관심 목록에 저장하지 못해 새 알림 예약을 정리했습니다. 앱은 계속 사용할 수 있습니다.",
    });
  }

  async function handleRemove(notice: NativeNotice): Promise<void> {
    patchEntry(notice.id, { busy: true });
    const current = await loadInterest(notice.id);
    await cancelNoticeNotifications(current?.notificationIds ?? []);
    const removed = await removeInterest(notice.id);
    patchEntry(notice.id, {
      interested: !removed,
      busy: false,
      feedback: removed
        ? "관심 공고와 예약된 로컬 알림을 해제했습니다."
        : "기기 저장소에서 관심 상태를 지우지 못했습니다. 관심 상태는 유지했으니 잠시 후 다시 시도해 주세요.",
    });
  }

  async function handleOpenOfficial(notice: NativeNotice): Promise<void> {
    patchEntry(notice.id, { feedback: "청약홈 공식 페이지를 엽니다." });
    const opened = await openOfficialApplyHome(notice.officialUrl);
    if (!opened) {
      patchEntry(notice.id, { feedback: "청약홈을 열지 못했습니다. 네트워크와 기본 브라우저 설정을 확인해 주세요." });
    }
  }

  function clearNotificationFocus(): void {
    setFocusedNoticeId(null);
    setSavedNotice(null);
    setNavigationFeedback(null);
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={styles.safeArea} edges={["top", "right", "bottom", "left"]}>
        <StatusBar style="dark" />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void reload()}
              tintColor={colors.accentDeep}
              colors={[colors.accentDeep]}
            />
          )}
        >
          <BrandHeader />
          {loading ? (
            <StatusCard>
              <ActivityIndicator color={colors.accentDeep} />
              <Text style={styles.statusTitle}>실공고를 불러오는 중</Text>
              <Text style={styles.statusBody}>공식 청약홈 데이터를 확인하고 있습니다. 잠시만 기다려 주세요.</Text>
            </StatusCard>
          ) : availableNotices.length === 0 && source === "not-connected" && !IS_NOTICES_CONFIGURED ? (
            <StatusCard>
              <Text style={styles.statusTitle}>실공고 연결 주소가 없습니다</Text>
              <Text style={styles.statusBody}>{error ?? "앱의 공고 연결 설정을 확인해 주세요."}</Text>
              <RetryButton onPress={() => void reload()} />
            </StatusCard>
          ) : availableNotices.length === 0 && source === "not-connected" ? (
            <StatusCard>
              <Text style={styles.statusTitle}>실공고를 불러오지 못했습니다</Text>
              <Text style={styles.statusBody}>{error ?? "잠시 후 다시 시도해 주세요."}</Text>
              <RetryButton onPress={() => void reload()} />
            </StatusCard>
          ) : availableNotices.length === 0 ? (
            <StatusCard>
              <Text style={styles.statusTitle}>현재 확인 가능한 활성 공고가 없습니다</Text>
              <Text style={styles.statusBody}>접수 예정·접수 중 공고를 찾지 못했습니다. 아래로 당기거나 다시 시도해 최신 자료를 확인해 주세요.</Text>
              <RetryButton onPress={() => void reload()} />
            </StatusCard>
          ) : (
            <View>
              <View style={styles.feedSummary} accessibilityRole="summary">
                <Text style={styles.feedCount}>청약홈 활성 공고 {notices.length}건</Text>
                <Text style={styles.feedFreshness}>{formatVerifiedAt(verifiedAt)}</Text>
                <Text style={styles.feedUpcoming}>앞으로 14일 안에 접수를 시작하는 공고 {upcomingReceiptCount}건</Text>
                <Text style={styles.feedHint}>아래로 당기면 최신 공고를 다시 확인합니다.</Text>
              </View>
              {source === "stale" && (
                <View style={styles.staleBanner}>
                  <Text style={styles.staleText}>
                    {error ?? "이 기기에 저장된 마지막 확인본입니다. 신청 전 청약홈 공식 페이지에서 원문과 정정 여부를 확인해 주세요."}
                  </Text>
                </View>
              )}
              {navigationFeedback && (
                <View style={styles.navigationBanner} accessibilityLiveRegion="polite">
                  <Text style={styles.navigationText}>{navigationFeedback}</Text>
                </View>
              )}
              <View style={styles.discoveryCard}>
                <View accessibilityLabel="공고 보기 방식" style={styles.viewToggle}>
                  <ViewModeButton
                    label="목록"
                    onPress={() => {
                      clearNotificationFocus();
                      setViewMode("list");
                      setSelectedCalendarDate(null);
                    }}
                    selected={viewMode === "list"}
                  />
                  <ViewModeButton
                    label="달력"
                    onPress={() => {
                      clearNotificationFocus();
                      setViewMode("calendar");
                      setDateFilter("all");
                    }}
                    selected={viewMode === "calendar"}
                  />
                </View>
                <Text style={styles.discoveryTitle}>
                  {viewMode === "list" ? "언제 시작하는 공고를 찾으세요?" : "날짜별 청약 일정을 확인하세요"}
                </Text>
                {viewMode === "list" ? (
                  <ScrollView
                    horizontal
                    contentContainerStyle={styles.filterRow}
                    showsHorizontalScrollIndicator={false}
                  >
                    {noticeDateFilters.map((filter) => (
                      <DateFilterButton
                        count={dateCounts[filter]}
                        filter={filter}
                        key={filter}
                        onPress={() => {
                          clearNotificationFocus();
                          setDateFilter(filter);
                        }}
                        selected={dateFilter === filter}
                      />
                    ))}
                  </ScrollView>
                ) : null}
                <View style={styles.searchRow}>
                  <TextInput
                    accessibilityLabel="공고명 지역 주소 유형 검색"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(value) => {
                      clearNotificationFocus();
                      setQuery(value);
                    }}
                    placeholder="공고명, 지역, 주소, 유형 검색"
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    style={styles.searchInput}
                    value={query}
                  />
                  {query ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setQuery("")}
                      style={({ pressed }) => [styles.clearButton, pressed && styles.retryPressed]}
                    >
                      <Text style={styles.clearLabel}>지우기</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !ready, selected: interestedOnly }}
                  disabled={!ready}
                  onPress={() => {
                    clearNotificationFocus();
                    setInterestedOnly((current) => !current);
                    setSelectedCalendarDate(null);
                  }}
                  style={({ pressed }) => [
                    styles.interestFilter,
                    interestedOnly && styles.interestFilterSelected,
                    !ready && styles.filterDisabled,
                    pressed && styles.retryPressed,
                  ]}
                >
                  <Text style={[styles.interestFilterLabel, interestedOnly && styles.filterLabelSelected]}>
                    관심 공고만 {interestCount}건
                  </Text>
                </Pressable>
                {viewMode === "calendar" ? (
                  <NoticeCalendar
                    monthOffset={calendarMonthOffset}
                    notices={discoveredNotices}
                    now={now}
                    onChangeMonth={setCalendarMonthOffset}
                    onSelectDate={(dateKey) => {
                      clearNotificationFocus();
                      setSelectedCalendarDate(dateKey);
                    }}
                    selectedDate={selectedCalendarDate}
                  />
                ) : null}
                <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
                  {viewMode === "calendar" && !selectedCalendarDate
                    ? "일정이 있는 날짜를 선택해 주세요"
                    : `조건에 맞는 공고 ${visibleNotices.length}건`}
                </Text>
              </View>
              {viewMode === "calendar" && !selectedCalendarDate ? (
                <StatusCard>
                  <Text style={styles.statusTitle}>달력에서 날짜를 선택해 주세요</Text>
                  <Text style={styles.statusBody}>접수 기간뿐 아니라 공고일·당첨 발표·계약 일정까지 날짜별로 확인할 수 있습니다.</Text>
                </StatusCard>
              ) : visibleNotices.length === 0 ? (
                <StatusCard>
                  <Text style={styles.statusTitle}>조건에 맞는 공고가 없습니다</Text>
                  <Text style={styles.statusBody}>접수 시기나 검색어를 바꿔 보세요. 전체 공고는 그대로 보존되어 있습니다.</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setDateFilter("all");
                      setQuery("");
                      setInterestedOnly(false);
                      setSelectedCalendarDate(null);
                    }}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
                  >
                    <Text style={styles.retryLabel}>필터 초기화</Text>
                  </Pressable>
                </StatusCard>
              ) : visibleNotices.map((notice, index) => {
                const entry = interest[notice.id] ?? EMPTY_ENTRY;
                return (
                  <View key={notice.id} style={index > 0 && styles.noticeGap}>
                    <NoticeOverview
                      notice={notice}
                      expanded={expandedNoticeId === notice.id}
                      onToggle={() => setExpandedNoticeId((current) => current === notice.id ? null : notice.id)}
                    />
                    {expandedNoticeId === notice.id && (
                      <>
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
                      </>
                    )}
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

const verifiedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

function formatVerifiedAt(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "공식 자료 확인 시각을 확인하는 중";
  return `공식 자료 확인 ${verifiedAtFormatter.format(new Date(value))}`;
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

function DateFilterButton({
  count,
  filter,
  onPress,
  selected,
}: {
  count: number;
  filter: NoticeDateFilter;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterButton,
        selected && styles.filterButtonSelected,
        pressed && styles.retryPressed,
      ]}
    >
      <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
        {noticeDateFilterLabels[filter]} {count}
      </Text>
    </Pressable>
  );
}

function ViewModeButton({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.viewButton,
        selected && styles.viewButtonSelected,
        pressed && styles.retryPressed,
      ]}
    >
      <Text style={[styles.viewButtonLabel, selected && styles.viewButtonLabelSelected]}>{label}</Text>
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
  feedSummary: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.hero,
  },
  feedCount: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  feedFreshness: {
    marginTop: 5,
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  feedUpcoming: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },
  feedHint: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  navigationBanner: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.hero,
  },
  navigationText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  discoveryCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: 12,
  },
  discoveryTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
  },
  viewToggle: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  viewButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  viewButtonSelected: { backgroundColor: colors.accentDeep },
  viewButtonLabel: { color: colors.muted, fontSize: 14, fontWeight: "900" },
  viewButtonLabelSelected: { color: "#FFFFFF" },
  filterRow: {
    gap: 8,
    paddingRight: 8,
  },
  filterButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
  },
  filterButtonSelected: {
    borderColor: colors.accentDeep,
    backgroundColor: colors.accentDeep,
  },
  filterLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  filterLabelSelected: {
    color: "#FFFFFF",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    backgroundColor: colors.page,
    fontSize: 15,
  },
  clearButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  clearLabel: {
    color: colors.accentDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  interestFilter: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
  },
  interestFilterSelected: {
    borderColor: colors.accentDeep,
    backgroundColor: colors.accentDeep,
  },
  interestFilterLabel: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  filterDisabled: { opacity: 0.48 },
  resultCount: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: "800",
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
