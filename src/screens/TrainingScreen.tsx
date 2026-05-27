import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TouchableOpacity, Image,
} from "react-native";
import { SafeAreaView }                         from "react-native-safe-area-context";
import { Ionicons }                             from "@expo/vector-icons";
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
  thumbnail_url:     string | null;
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

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const STATUS_ICON: Record<string, IoniconName> = {
  in_progress: "play-circle-outline",
  enrolled:    "ellipse-outline",
  completed:   "checkmark-circle",
};

function dueDaysLabel(due: string | null): string | null {
  if (!due) return null;
  const diff = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return `Overdue ${Math.abs(diff)}d`;
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
          lms_courses ( id, title, category, is_mandatory, estimated_minutes, thumbnail_url )
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

  const visible = filter === "all" ? rows : rows.filter(r => r.status === filter);
  const pending  = rows.filter(r => r.status !== "completed").length;
  const complete = rows.filter(r => r.status === "completed").length;

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all",         label: "All"          },
    { key: "in_progress", label: "In progress"  },
    { key: "enrolled",    label: "Not started"  },
    { key: "completed",   label: "Complete"     },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>My Training</Text>
          <Text style={styles.pageSub}>
            {loading ? "Loading…" : `${pending} pending · ${complete} complete`}
          </Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.refreshBtn} disabled={loading}>
          <Ionicons name="refresh-outline" size={20} color={loading ? colors.textMuted : colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Filter chips ────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.chip,
              filter === f.key && styles.chipActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
              {f.key !== "all" && rows.filter(r => f.key === "enrolled" ? r.status === "enrolled" : r.status === f.key).length > 0
                ? ` · ${rows.filter(r => f.key === "enrolled" ? r.status === "enrolled" : r.status === f.key).length}`
                : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Body ────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your courses…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load training</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {visible.length === 0 ? (
            <View style={styles.empty}>
              {rows.length === 0 ? (
                <>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="book-outline" size={32} color={colors.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>No courses assigned</Text>
                  <Text style={styles.emptyBody}>
                    Your manager hasn't assigned any training yet.{"\n"}Check back soon.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="checkmark-done-outline" size={32} color={colors.success} />
                  </View>
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
              const isDone    = item.status === "completed";

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate("CourseDetail", {
                    enrollmentId: item.id,
                    courseId,
                    courseTitle:  course?.title ?? "Course",
                  })}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  {/* Thumbnail banner (optional) */}
                  {course?.thumbnail_url ? (
                    <Image
                      source={{ uri: course.thumbnail_url }}
                      style={styles.cardThumb}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}

                  <View style={styles.cardRow}>
                  {/* Left accent bar */}
                  <View style={[styles.cardAccent, { backgroundColor: dotColor }]} />

                  <View style={styles.cardBody}>
                    {/* Top row: status + due */}
                    <View style={styles.cardMeta}>
                      <View style={[styles.statusPill, { backgroundColor: dotColor + "15" }]}>
                        <Ionicons name={STATUS_ICON[item.status] ?? "ellipse-outline"} size={11} color={dotColor} />
                        <Text style={[styles.statusText, { color: dotColor }]}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </Text>
                      </View>
                      <View style={styles.cardMetaRight}>
                        {course?.is_mandatory && (
                          <View style={styles.mandatoryBadge}>
                            <Text style={styles.mandatoryText}>Required</Text>
                          </View>
                        )}
                        {dueLabel && (
                          <Text style={[styles.dueText, isOverdue && styles.dueOverdue]}>
                            {dueLabel}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {course?.title ?? "Unknown course"}
                    </Text>

                    {/* Meta badges */}
                    {(course?.category || course?.estimated_minutes) && (
                      <View style={styles.metaRow}>
                        {course?.category && (
                          <View style={styles.metaBadge}>
                            <Ionicons name="folder-outline" size={10} color={colors.textMuted} />
                            <Text style={styles.metaBadgeText}>{course.category}</Text>
                          </View>
                        )}
                        {course?.estimated_minutes ? (
                          <View style={styles.metaBadge}>
                            <Ionicons name="time-outline" size={10} color={colors.textMuted} />
                            <Text style={styles.metaBadgeText}>{course.estimated_minutes} min</Text>
                          </View>
                        ) : null}
                      </View>
                    )}

                    {/* Progress bar */}
                    <View style={styles.progressSection}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, {
                          width: `${item.progress_pct}%` as any,
                          backgroundColor: dotColor,
                        }]} />
                      </View>
                      <Text style={styles.progressLabel}>{item.progress_pct}%</Text>
                    </View>

                    {/* Footer: CTA or completed */}
                    {isDone ? (
                      <View style={styles.completedRow}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={styles.completedDate}>
                          Completed {item.completed_at ? new Date(item.completed_at).toLocaleDateString("en-AU", {
                            day: "numeric", month: "short", year: "numeric",
                          }) : ""}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.ctaBtn, { backgroundColor: dotColor + "12" }]}>
                        <Text style={[styles.ctaBtnText, { color: dotColor }]}>
                          {item.progress_pct > 0 ? "Continue course" : "Start course"}
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color={dotColor} />
                      </View>
                    )}
                  </View>
                  </View>{/* end cardRow */}
                </Pressable>
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
  safe:      { flex: 1, backgroundColor: colors.background },

  // Header
  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  pageTitle:  { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:    { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  refreshBtn: { padding: 6, marginTop: 2 },

  // Filter chips
  chips:       { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  chip:        { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:    { fontSize: font.sizes.xs, color: colors.textSecondary, fontWeight: "700" },
  chipTextActive: { color: colors.white },

  // Center states
  center:         { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  loadingText:    { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  errorIconWrap:  { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  errorTitle:     { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  errorBody:      { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  retryBtn:       { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md },
  retryText:      { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },

  // List
  list:        { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm, paddingTop: spacing.xs },
  empty:       { alignItems: "center", paddingTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIconWrap: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm, ...shadow.xs },
  emptyTitle:  { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:   { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4, textAlign: "center", lineHeight: 20 },

  // Card
  card:        {
    flexDirection: "column",
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadow.card,
  },
  cardPressed: { opacity: 0.88 },
  cardThumb:   { width: "100%", height: 130 },
  cardRow:     { flexDirection: "row" },
  cardAccent:  { width: 4 },
  cardBody:    { flex: 1, padding: spacing.md, gap: spacing.xs },

  // Card meta
  cardMeta:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  statusText:    { fontSize: 11, fontWeight: "700" },
  cardMetaRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  mandatoryBadge: { backgroundColor: colors.warningLight, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3 },
  mandatoryText:  { fontSize: 10, fontWeight: "700", color: "#92400E" },
  dueText:       { fontSize: font.sizes.xs, color: colors.textMuted },
  dueOverdue:    { color: colors.danger, fontWeight: "700" },

  cardTitle:  { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, lineHeight: 20 },

  // Meta badges
  metaRow:       { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  metaBadge:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.background, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm },
  metaBadgeText: { fontSize: 10, color: colors.textMuted, fontWeight: "500" },

  // Progress
  progressSection: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  progressTrack:   { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden" },
  progressFill:    { height: "100%", borderRadius: radius.full },
  progressLabel:   { fontSize: font.sizes.xs, color: colors.textMuted, fontWeight: "600", minWidth: 28 },

  // CTA / completed
  ctaBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderRadius: radius.md, paddingVertical: 10 },
  ctaBtnText:  { fontSize: font.sizes.sm, fontWeight: "700" },
  completedRow:  { flexDirection: "row", alignItems: "center", gap: 5 },
  completedDate: { fontSize: font.sizes.xs, color: colors.success, fontWeight: "600" },
});
