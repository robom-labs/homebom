// 공고의 출처와 안정 식별자, 공급 핵심값을 카드로 보여준다.
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeNotice } from "../domain/notice";
import { colors } from "../theme";

type Props = {
  notice: NativeNotice;
  expanded: boolean;
  onToggle: () => void;
};

const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL ?? "https://robom.kr/support";
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://robom.kr/privacy/homebom";

export function NoticeOverview({ notice, expanded, onToggle }: Props) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${notice.title} ${expanded ? "상세 접기" : "상세 보기"}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.summaryButton, pressed && styles.summaryPressed]}
      >
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>청약홈 공고</Text>
          <Text style={styles.category}>{notice.category}</Text>
        </View>
        <Text style={styles.title}>{notice.title}</Text>
        <Text style={styles.meta}>
          {notice.region}{notice.supplyCount === null ? "" : ` · 공급 ${notice.supplyCount}세대`}
        </Text>
        <Text style={styles.address}>{notice.address}</Text>
        <Text style={styles.toggleLabel}>{expanded ? "상세 접기" : "일정과 알림 보기"}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.expandedDetails}>
          <View style={styles.identityBox}>
            <Text style={styles.identityLabel}>공고 식별번호</Text>
            <Text selectable style={styles.identityValue}>{notice.id}</Text>
          </View>
          <Text style={styles.source}>출처 · {notice.sourceLabel}</Text>
          <Text style={styles.disclaimer}>표시된 정보는 청약홈 공식 자료 기준입니다. 신청 전 청약홈에서 원문과 정정 여부를 확인하세요.</Text>
          <Text style={styles.affiliation}>청약봄은 정부기관, 한국부동산원 또는 청약홈의 공식·제휴·승인 앱이 아니며 청약 신청을 직접 처리하지 않습니다.</Text>
          <View style={styles.legalLinks}>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(SUPPORT_URL).catch(() => undefined)} style={styles.legalLinkButton}>
              <Text style={styles.legalLink}>지원</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => undefined)} style={styles.legalLinkButton}>
              <Text style={styles.legalLink}>개인정보 처리방침</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  summaryButton: {
    minHeight: 48,
  },
  summaryPressed: {
    opacity: 0.72,
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
  toggleLabel: {
    marginTop: 14,
    color: colors.accentDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  expandedDetails: {
    marginTop: 2,
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
  affiliation: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  legalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  legalLinkButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  legalLink: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
