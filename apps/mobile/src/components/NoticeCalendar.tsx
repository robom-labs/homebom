// 청약 일정을 이번 달과 다음 달에서 고르고 해당 날짜의 공고를 여는 모바일 달력이다.
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  buildNoticeCalendarMonth,
  calendarWeekdays,
} from "../domain/noticeCalendar";
import type { NativeNotice } from "../domain/notice";
import { colors } from "../theme";

type Props = {
  monthOffset: number;
  notices: readonly NativeNotice[];
  now?: number;
  onChangeMonth: (offset: number) => void;
  onSelectDate: (dateKey: string | null) => void;
  selectedDate: string | null;
};

const kindStyles = {
  announcement: { color: colors.focus, label: "공고" },
  receipt: { color: colors.accentDeep, label: "접수" },
  winner: { color: colors.warning, label: "발표" },
  contract: { color: colors.danger, label: "계약" },
} as const;

export function NoticeCalendar({
  monthOffset,
  notices,
  now = Date.now(),
  onChangeMonth,
  onSelectDate,
  selectedDate,
}: Props) {
  const month = buildNoticeCalendarMonth(notices, now, monthOffset);

  return (
    <View style={styles.card} accessibilityLabel={`${month.label} 청약 일정 달력`}>
      <View style={styles.header}>
        <View style={styles.titleCopy}>
          <Text style={styles.eyebrow}>청약 일정</Text>
          <Text style={styles.title}>{month.label}</Text>
        </View>
        <View accessibilityLabel="달 선택" style={styles.monthTabs}>
          {[0, 1].map((offset) => {
            const selected = monthOffset === offset;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={offset}
                onPress={() => {
                  onChangeMonth(offset);
                  onSelectDate(null);
                }}
                style={({ pressed }) => [
                  styles.monthTab,
                  selected && styles.monthTabSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.monthTabLabel, selected && styles.monthTabLabelSelected]}>
                  {offset === 0 ? "이번 달" : "다음 달"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View accessibilityLabel="일정 색상 안내" style={styles.legend}>
        {Object.values(kindStyles).map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.weekRow} accessibilityElementsHidden>
        {calendarWeekdays.map((label, index) => (
          <Text
            key={label}
            style={[
              styles.weekLabel,
              index === 0 && styles.sunday,
              index === 6 && styles.saturday,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {month.cells.map((cell, index) => {
          if (!cell.inMonth) return <View key={`blank-${index}`} style={styles.cell} />;
          const selected = selectedDate === cell.key;
          const enabled = cell.noticeCount > 0;
          const kindLabel = cell.kinds.map((kind) => ({
            announcement: "공고",
            receipt: "접수",
            winner: "발표",
            contract: "계약",
          })[kind]).join("·");
          return (
            <Pressable
              accessibilityLabel={`${cell.day}일 ${enabled ? `${kindLabel} 공고 ${cell.noticeCount}건` : "일정 없음"}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !enabled, selected }}
              disabled={!enabled}
              key={cell.key}
              onPress={() => onSelectDate(selected ? null : cell.key)}
              style={({ pressed }) => [
                styles.cell,
                enabled && styles.cellEnabled,
                cell.today && styles.cellToday,
                selected && styles.cellSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.day, cell.today && styles.dayToday]}>{cell.day}</Text>
              {enabled ? (
                <View style={styles.markerRow}>
                  <View style={styles.marker}>
                    <Text style={[styles.markerText, cell.today && styles.markerTextToday]}>
                      {cell.noticeCount}
                    </Text>
                  </View>
                  <View accessibilityElementsHidden style={styles.kindDots}>
                    {cell.kinds.map((kind) => (
                      <View
                        key={kind}
                        style={[styles.kindDot, { backgroundColor: kindStyles[kind].color }]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {selectedDate
          ? `${Number(selectedDate.slice(5, 7))}월 ${Number(selectedDate.slice(8, 10))}일 일정을 선택했습니다.`
          : "일정이 있는 날짜를 누르면 해당 공고만 바로 볼 수 있습니다."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.hero,
    padding: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  titleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.accentDeep, fontSize: 11, fontWeight: "900" },
  title: { marginTop: 2, color: colors.ink, fontSize: 18, fontWeight: "900" },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  monthTabs: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  monthTab: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  monthTabSelected: { backgroundColor: colors.surface },
  monthTabLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  monthTabLabelSelected: { color: colors.accentDeep },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekLabel: {
    width: "14.2857%",
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  sunday: { color: colors.danger },
  saturday: { color: colors.focus },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.2857%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cellEnabled: { backgroundColor: colors.surface },
  cellToday: { backgroundColor: colors.accentDeep },
  cellSelected: { borderColor: colors.focus, borderWidth: 2 },
  day: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  dayToday: { color: "#FFFFFF" },
  marker: {
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.hero,
  },
  markerRow: { alignItems: "center", gap: 2 },
  kindDots: { flexDirection: "row", gap: 2 },
  kindDot: { width: 4, height: 4, borderRadius: 2 },
  markerText: { color: colors.accentDeep, fontSize: 9, fontWeight: "900" },
  markerTextToday: { color: colors.accentDeep },
  hint: { marginTop: 8, color: colors.muted, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.72 },
});
