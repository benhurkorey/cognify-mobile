import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

const MOCK_TRAININGS = [
  { id: "1", title: "Fire Safety & Emergency Procedures", category: "Safety",     due: "2 days",  progress: 0,   status: "due"       },
  { id: "2", title: "Manual Handling",                   category: "Safety",     due: "7 days",  progress: 45,  status: "in_progress" },
  { id: "3", title: "Customer Service Fundamentals",     category: "Compliance", due: "14 days", progress: 100, status: "complete"  },
  { id: "4", title: "Workplace Harassment Policy",       category: "HR",         due: "21 days", progress: 0,   status: "due"       },
  { id: "5", title: "Food Safety Level 2",               category: "Compliance", due: "30 days", progress: 75,  status: "in_progress" },
];

const STATUS_COLOR: Record<string, string> = {
  due:         colors.warning,
  in_progress: colors.primary,
  complete:    colors.success,
};

const STATUS_LABEL: Record<string, string> = {
  due:         "Due",
  in_progress: "In progress",
  complete:    "Complete",
};

export default function TrainingScreen() {
  const [filter, setFilter] = useState<"all" | "due" | "in_progress" | "complete">("all");
  const visible = filter === "all" ? MOCK_TRAININGS : MOCK_TRAININGS.filter(t => t.status === filter);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>My Training</Text>
        <Text style={styles.pageSub}>{MOCK_TRAININGS.filter(t => t.status !== "complete").length} modules pending</Text>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(["all", "due", "in_progress", "complete"] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === "all" ? "All" : f === "in_progress" ? "In progress" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {visible.map(item => (
          <TouchableOpacity key={item.id} style={styles.card} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <View style={styles.cardMeta}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
                <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
                <Text style={styles.categoryBadge}>{item.category}</Text>
              </View>
              {item.status !== "complete" && (
                <Text style={styles.dueText}>Due in {item.due}</Text>
              )}
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${item.progress}%` as any,
                backgroundColor: STATUS_COLOR[item.status],
              }]} />
            </View>
            <Text style={styles.progressLabel}>{item.progress}% complete</Text>

            {item.status !== "complete" && (
              <TouchableOpacity style={styles.startBtn} activeOpacity={0.8}>
                <Text style={styles.startBtnText}>
                  {item.progress > 0 ? "Continue" : "Start"}
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        {visible.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyBody}>No training modules in this category.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.background },
  headerArea:    { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pageTitle:     { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:       { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  chips:         { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chip:          { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:      { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: "600" },
  chipTextActive:{ color: colors.white },
  list:          { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card:          { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadow.card },
  cardHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  cardMeta:      { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statusDot:     { width: 7, height: 7, borderRadius: radius.full },
  statusText:    { fontSize: font.sizes.xs, fontWeight: "700" },
  categoryBadge: { fontSize: font.sizes.xs, color: colors.textMuted, backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  dueText:       { fontSize: font.sizes.xs, color: colors.textMuted },
  cardTitle:     { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden", marginBottom: 4 },
  progressFill:  { height: "100%", borderRadius: radius.full },
  progressLabel: { fontSize: font.sizes.xs, color: colors.textMuted, marginBottom: spacing.sm },
  startBtn:      { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  startBtnText:  { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },
  empty:         { alignItems: "center", paddingTop: spacing.xxl },
  emptyIcon:     { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle:    { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:     { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4 },
});
