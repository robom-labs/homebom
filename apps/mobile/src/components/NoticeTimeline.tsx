// 공고·접수·발표·계약 순서와 현재 다음 행동을 한 화면에 표시한다.
import { StyleSheet, Text, View } from "react-native";
import { buildTimeline, formatMilestoneRange, getNextMilestone, type NativeNotice } from "../domain/notice";
import { colors } from "../theme";

type Props = {
  notice: NativeNotice;
  now: Date;
};

const stateLabel = {
  completed: "완료",
  next: "다음",
  upcoming: "예정",
} as const;

export function NoticeTimeline({ notice, now }: Props) {
  const timeline = buildTimeline(notice, now);
  const next = getNextMilestone(notice, now);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>공식 일정과 다음 행동</Text>
      <View style={styles.nextCard}>
        <Text style={styles.nextEyebrow}>{next?.isInProgress ? "지금 진행 중" : "가장 가까운 다음 행동"}</Text>
        <Text style={styles.nextTitle}>{next ? `${next.label} · ${formatMilestoneRange(next)}` : "표시할 공식 일정이 모두 지났습니다"}</Text>
        <Text style={styles.nextAction}>{next?.nextAction ?? "청약홈에서 공고의 최신 상태를 확인하세요."}</Text>
      </View>

      <View style={styles.list}>
        {timeline.map((milestone) => (
          <View key={milestone.kind} style={styles.item}>
            <View style={[styles.dot, milestone.state === "next" && styles.dotNext, milestone.state === "completed" && styles.dotDone]} />
            <View style={styles.itemCopy}>
              <View style={styles.itemHeading}>
                <Text style={styles.itemLabel}>{milestone.label}</Text>
                <Text style={[styles.state, milestone.state === "next" && styles.stateNext]}>
                  {milestone.isInProgress ? "진행 중" : stateLabel[milestone.state]}
                </Text>
              </View>
              <Text style={styles.date}>{formatMilestoneRange(milestone)}</Text>
              <Text style={styles.action}>{milestone.nextAction}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
  },
  heading: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  nextCard: {
    marginTop: 12,
    padding: 17,
    borderRadius: 20,
    backgroundColor: colors.heroStrong,
  },
  nextEyebrow: {
    color: colors.accentDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  nextTitle: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
  },
  nextAction: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  list: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  dot: {
    width: 12,
    height: 12,
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: colors.line,
  },
  dotNext: {
    backgroundColor: colors.accent,
  },
  dotDone: {
    backgroundColor: colors.muted,
  },
  itemCopy: {
    flex: 1,
  },
  itemHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  state: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  stateNext: {
    color: colors.accentDeep,
  },
  date: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  action: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
});
