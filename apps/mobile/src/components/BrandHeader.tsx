// 공통 봄 계열의 청약봄 이름과 네이티브 앱 설명을 표시한다.
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function BrandHeader() {
  return (
    <View style={styles.header} accessibilityRole="header">
      <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image source={require("../../assets/icon.png")} style={styles.markImage} resizeMode="contain" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.wordmark} accessibilityRole="text">청약봄</Text>
        <Text style={styles.tagline}>공고부터 계약까지, 다음 행동을 놓치지 않게</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  mark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.heroStrong,
    borderWidth: 1,
    borderColor: "#B9DDBF",
  },
  markImage: {
    width: 46,
    height: 46,
    borderRadius: 13,
  },
  copy: {
    flex: 1,
  },
  wordmark: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  tagline: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
