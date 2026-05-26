import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MOCK_SHIFTS = [
  { id: "1", day: "Mon", date: "2 Jun", start: "09:00", end: "17:00", location: "Warehouse A", status: "confirmed" },
  { id: "2", day: "Tue", date: "3 Jun", start: "09:00", end: "17:00", location: "Warehouse A", status: "confirmed" },
  { id: "3", day: "Wed", date: "4 Jun", start: "12:00", end: "20:00", location: "Store Front", status: "confirmed" },
  { id: "4", day: "Thu", date: "5 Jun", start: "",      end: "",      location: "",            status: "off"        },
  { id: "5", day: "Fri", date: "6 Jun", start: "09:00", end: "17:00", location: "Office",     status: "pending"   },
  { id: "6", day: "Sat", date: "7 Jun", start: "",      end: "",      location: "",            status: "off"        },
  { id: "7", day: "Sun", date: "8 Jun", start: "",      end: "",      location: "",            status: "off"        },
];

const STATUS_META: Record<string, { color: string; label: string }> = {
  confirmed: { color: colors.success,  label: "Confirmed" },
  pending:   { color: colors.warning,  label: "Pending"   },
  off:       { color: colors.textMuted, label: "Day off"  },
};

export default function ShiftsScreen() {
  const [selectedDay, setSelectedDay] = useState(0);
  const shift = MOCK_SHIFTS[selectedDay];

  const workDays   = MOCK_SHIFTS.filter(s => s.status !== "off").length;
  const totalHours = MOCK_SHIFTS.filter(s => s.start).reduce((acc, s) => {
    if (!s.start || !s.end) return acc;
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    return acc + (eh + em / 60) - (sh + sm / 60);
  }, 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerArea}>
          <Text style={styles.pageTitle}>My Shifts</Text>
          <Text style={styles.pageSub}>Week of 2–8 Jun 2026</Text>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{workDays}</Text>
            <Text style={styles.summaryLabel}>Shifts this week</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{totalHours}h</Text>
            <Text style={styles.summaryLabel}>Total hours</Text>
          </View>
        </View>

        {/* Day selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
          {MOCK_SHIFTS.map((s, i) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSelectedDay(i)}
              style={[
                styles.dayBtn,
                selectedDay === i && styles.dayBtnActive,
                s.status === "off" && styles.dayBtnOff,
              ]}
            >
              <Text style={[styles.dayLabel, selectedDay === i && styles.dayLabelActive]}>{s.day}</Text>
              <Text style={[styles.dateLabel, selectedDay === i && styles.dateLabelActive]}>{s.date.split(" ")[0]}</Text>
              {s.status !== "off" && (
                <View style={[styles.shiftDot, { backgroundColor: selectedDay === i ? colors.white : STATUS_META[s.status].color }]} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Shift detail card */}
        <View style={styles.detailCard}>
          {shift.status === "off" ? (
            <View style={styles.offDay}>
              <Text style={styles.offIcon}>😴</Text>
              <Text style={styles.offTitle}>Day off</Text>
              <Text style={styles.offSub}>Enjoy your rest day!</Text>
            </View>
          ) : (
            <>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.detailDay}>{shift.day}, {shift.date}</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_META[shift.status].color }]} />
                    <Text style={[styles.statusLabel, { color: STATUS_META[shift.status].color }]}>
                      {STATUS_META[shift.status].label}
                    </Text>
                  </View>
                </View>
                <View style={styles.timeBox}>
                  <Text style={styles.timeText}>{shift.start} – {shift.end}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📍</Text>
                <View>
                  <Text style={styles.detailRowLabel}>Location</Text>
                  <Text style={styles.detailRowValue}>{shift.location}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>⏱</Text>
                <View>
                  <Text style={styles.detailRowLabel}>Duration</Text>
                  <Text style={styles.detailRowValue}>
                    {(() => {
                      const [sh, sm] = shift.start.split(":").map(Number);
                      const [eh, em] = shift.end.split(":").map(Number);
                      return `${(eh + em / 60) - (sh + sm / 60)}h`;
                    })()}
                  </Text>
                </View>
              </View>

              {shift.status === "pending" && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]}>
                    <Text style={styles.actionBtnText}>Accept shift</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#F1F5F9" }]}>
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Upcoming list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All shifts this week</Text>
          {MOCK_SHIFTS.filter(s => s.status !== "off").map(s => (
            <View key={s.id} style={styles.shiftRow}>
              <Text style={styles.shiftDay}>{s.day} {s.date}</Text>
              <Text style={styles.shiftTime}>{s.start} – {s.end}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_META[s.status].color + "20" }]}>
                <Text style={[styles.badgeText, { color: STATUS_META[s.status].color }]}>{STATUS_META[s.status].label}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.background },
  headerArea:      { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pageTitle:       { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:         { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  summaryRow:      { flexDirection: "row", paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  summaryCard:     { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: "center", ...shadow.card },
  summaryValue:    { fontSize: font.sizes.xl, fontWeight: "800" },
  summaryLabel:    { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  dayRow:          { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  dayBtn:          { width: 56, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border },
  dayBtnActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  dayBtnOff:       { opacity: 0.5 },
  dayLabel:        { fontSize: font.sizes.xs, fontWeight: "700", color: colors.textSecondary },
  dayLabelActive:  { color: colors.white },
  dateLabel:       { fontSize: font.sizes.sm, fontWeight: "800", color: colors.text },
  dateLabelActive: { color: colors.white },
  shiftDot:        { width: 6, height: 6, borderRadius: radius.full },
  detailCard:      { marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card, marginBottom: spacing.lg },
  offDay:          { alignItems: "center", paddingVertical: spacing.lg },
  offIcon:         { fontSize: 40, marginBottom: spacing.sm },
  offTitle:        { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  offSub:          { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4 },
  detailHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  detailDay:       { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  statusRow:       { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 },
  statusDot:       { width: 7, height: 7, borderRadius: radius.full },
  statusLabel:     { fontSize: font.sizes.xs, fontWeight: "700" },
  timeBox:         { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  timeText:        { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },
  detailRow:       { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  detailIcon:      { fontSize: 20, width: 28 },
  detailRowLabel:  { fontSize: font.sizes.xs, color: colors.textSecondary },
  detailRowValue:  { fontSize: font.sizes.base, fontWeight: "600", color: colors.text },
  actionRow:       { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn:       { flex: 1, borderRadius: radius.sm, paddingVertical: 12, alignItems: "center" },
  actionBtnText:   { fontSize: font.sizes.sm, fontWeight: "700", color: colors.white },
  section:         { paddingHorizontal: spacing.md, marginBottom: spacing.xxl },
  sectionTitle:    { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  shiftRow:        { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  shiftDay:        { flex: 1, fontSize: font.sizes.sm, fontWeight: "600", color: colors.text },
  shiftTime:       { fontSize: font.sizes.sm, color: colors.textSecondary },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeText:       { fontSize: font.sizes.xs, fontWeight: "700" },
});
