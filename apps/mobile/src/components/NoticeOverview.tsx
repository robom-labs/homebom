// 공고의 출처와 안정 식별자, 공급 핵심값을 카드로 보여준다.
import { StyleSheet, Text, View } from "react-native";
import type { NativeNotice } from "../domain/notice";
import { colors } from "../theme";

type Props = {
  notice: NativeNotice;
};

export function NoticeOverview({ notice }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={styles.badge}>청약홈 공고</Text>
        <Text style={styles.category}>{notice.category}</Text>
      </View>
      <Text style={styles.title}>{notice.title}</Text>
      <Text style={styles.meta}>{notice.region} · 공급 {notice.supplyCount}세대</Text>
      <Text style={styles.address}>{notice.address}</Text>
      <View style={styles.identityBox}>
        <Text style={styles.identityLabel}>안정 ID</Text>
        <Text selectable style={styles.identityValue}>{notice.id}</Text>
      </View>
      <Text style={styles.source}>출처 · {notice.sourceLabel}</Text>
      <Text style={styles.disclaimer}>표시된 정보는 청약홈 공식 자료 기준입니다. 신청 전 청약홈에서 원문과 정정 여부를 확인하세요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 22,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    color: colors.accentDeep,
    backgroundColor: colors.heroStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  category: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    marginTop: 14,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  meta: {
    marginTop: 8,
    color: colors.accentDeep,
    fontSize: 15,
    fontWeight: "800",
  },
  address: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  identityBox: {
    marginTop: 15,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  identityLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  identityValue: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  source: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 12,
  },
  disclaimer: {
    marginTop: 8,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
});
