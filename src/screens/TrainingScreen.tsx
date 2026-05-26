import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView }                         from "react-native-safe-area-context";
import type { NativeStackScreenProps }          from "@react-navigation/native-stack";
import { supabase }                             from "../lib/supabase";
import { useAuth }                              from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";
import type { TrainingStackParamList }          from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseRow {
  id:                string;
  title:             string;
  category:          string | null;
  is_mandatory:      boolean;
  estimated_minutes: number | null;
}

interface EnrollmentRow {
  id:           string;
  status:       string;
  progress_pct: number;
  due_date:     string | null;
  completed_at: string | null;
  lms_courses:  CourseRow | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FilterKey = "all" | "in_progress" | "enrolled" | "completed";

const STATUS_COLOR: Record<string, string> = {
  in_progress: colors.primary,
  enrolled:    colors.warning,
  completed:   colors.success,
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  enrolled:    "Not started",
  completed:   "Complete",
};

function dueDaysLabel(due: string | null): string | null {
  if (!due) return null;
  const diff = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  return `Due in ${diff}d`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<TrainingStackParamList, "TrainingList">;

export default function TrainingScreen({ navigation }: Props) {
  const { user }  = useAuth();
  const [rows,    setRows]    = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<FilterKey>("all");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("lms_enrollments")
        .select(`
          id,
          status,
          progress_pct,
          due_date,
          completed_at,
          lms_courses ( id, title, category, is_mandatory, estimated_minutes )
        `)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (qErr) throw qErr;
      setRows((data as unknown as EnrollmentRow[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load training.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const visible = filter === "all"
    ? rows
    : rows.filter(r => r.status === filter);

  const pending  = rows.filter(r => r.status !== "completed").length;
  const complete = rows.filter(r => r.status === "completed").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>My Training</Text>
        <Text style={styles.pageSub}>
          {loading ? "Loading…" : `${pending} pending · ${complete} complete`}
        </Text>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(["all", "in_progress", "enrolled", "completed"] as FilterKey[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, filter === f && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === "all" ? "All" : STATUS_LABEL[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your courses…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn't load training</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {visible.length === 0 ? (
            <View style={styles.empty}>
              {rows.length === 0 ? (
                <>
                  <Text style={styles.emptyIcon}>📚</Text>
                  <Text style={styles.emptyTitle}>No courses assigned</Text>
                  <Text style={styles.emptyBody}>
                    Your manager hasn't assigned any training yet.{"\n"}Check back soon.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyIcon}>🎉</Text>
                  <Text style={styles.emptyTitle}>Nothing here</Text>
                  <Text style={styles.emptyBody}>No courses match this filter.</Text>
                </>
              )}
            </View>
          ) : (
            visible.map(item => {
              const course    = item.lms_courses;
              const dotColor  = STATUS_COLOR[item.status] ?? colors.textMuted;
              const dueLabel  = dueDaysLabel(item.due_date);
              const isOverdue = dueLabel?.startsWith("Overdue");
              const courseId  = (course as any)?.id ?? "";

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate("CourseDetail", {
                    enrollmentId: item.id,
                    courseId,
                    courseTitle:  course?.title ?? "Course",
                  })}
                >
                  {/* Status row */}
                  <View style={styles.cardMeta}>
                    <View style={styles.statusLeft}>
                      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                      <Text style={[styles.statusText, { color: dotColor }]}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </Text>
                      {course?.is_mandatory && (
                        <View style={styles.mandatoryBadge}>
                          <Text style={styles.mandatoryText}>Required</Text>
                        </View>
                      )}
                    </View>
                    {dueLabel && (
                      <Text style={[styles.dueText, isOverdue && styles.dueOverdue]}>
                        {dueLabel}
                      </Text>
                    )}
                  </View>

                  {/* Title */}
                  <Text style={styles.cardTitle}>
                    {course?.title ?? "Unknown course"}
                  </Text>

                  {/* Meta row */}
                  <View style={styles.metaRow}>
                    {course?.category && (
                      <Text style={styles.categoryBadge}>{course.category}</Text>
                    )}
                    {course?.estimated_minutes && (
                      <Text style={styles.minutesBadge}>
                        ⏱ {course.estimated_minutes} min
                      </Text>
                    )}
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, {
                      width: `${item.progress_pct}%` as any,
                      backgroundColor: dotColor,
                    }]} />
                  </View>
                  <Text style={styles.progressLabel}>{item.progress_pct}% complete</Text>

                  {/* CTA */}
                  {item.status !== "completed" && (
                    <TouchableOpacity style={styles.startBtn} activeOpacity={0.8}>
                      <Text style={styles.startBtnText}>
                        {item.progress_pct > 0 ? "Continue" : "Start"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Completed date */}
                  {item.status === "completed" && item.completed_at && (
                    <Text style={styles.completedDate}>
                      ✓ Completed {new Date(item.completed_at).toLocaleDateString("en-AU", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.background },
  header:         { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 4 },
  pageTitle:      { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:        { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  chips:          { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chip:           { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:       { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  loadingText:    { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  errorIcon:      { fontSize: 36, marginBottom: spacing.sm },
  errorTitle:     { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  errorBody:      { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  retryBtn:       { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.sm },
  retryText:      { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },
  list:           { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty:          { alignItems: "center", paddingTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon:      { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle:     { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:      { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4, textAlign: "center", lineHeight: 20 },
  card:           { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadow.card },
  cardMeta:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  statusLeft:     { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statusDot:      { width: 7, height: 7, borderRadius: radius.full },
  statusText:     { fontSize: font.sizes.xs, fontWeight: "700" },
  mandatoryBadge: { backgroundColor: "#FEF3C7", borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  mandatoryText:  { fontSize: font.sizes.xs, fontWeight: "700", color: "#92400E" },
  dueText:        { fontSize: font.sizes.xs, color: colors.textMuted },
  dueOverdue:     { color: colors.danger, fontWeight: "700" },
  cardTitle:      { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  metaRow:        { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  categoryBadge:  { fontSize: font.sizes.xs, color: colors.textMuted, backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  minutesBadge:   { fontSize: font.sizes.xs, color: colors.textMuted, backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  progressTrack:  { height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden", marginBottom: 4 },
  progressFill:   { height: "100%", borderRadius: radius.full },
  progressLabel:  { fontSize: font.sizes.xs, color: colors.textMuted, marginBottom: spacing.sm },
  startBtn:       { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  startBtnText:   { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },
  completedDate:  { fontSize: font.sizes.xs, color: colors.success, fontWeight: "600" },
});
