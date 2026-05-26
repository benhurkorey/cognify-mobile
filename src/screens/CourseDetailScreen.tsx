import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView }                          from "react-native-safe-area-context";
import type { NativeStackScreenProps }           from "@react-navigation/native-stack";
import { supabase }                              from "../lib/supabase";
import { useAuth }                               from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";
import type { TrainingStackParamList }           from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
  id:           string;
  title:        string;
  content_type: string;
  sort_order:   number;
}

interface Module {
  id:          string;
  title:       string;
  description: string | null;
  sort_order:  number;
  lessons:     Lesson[];
}

interface EnrollmentDetail {
  status:       string;
  progress_pct: number;
  due_date:     string | null;
  lms_courses: {
    title:             string;
    category:          string | null;
    description:       string | null;
    is_mandatory:      boolean;
    estimated_minutes: number | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (diff < 0)   return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  return `Due in ${diff}d`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<TrainingStackParamList, "CourseDetail">;

export default function CourseDetailScreen({ route, navigation }: Props) {
  const { enrollmentId, courseId } = route.params;
  const { user }    = useAuth();

  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [modules,    setModules]    = useState<Module[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      // 1 — Enrollment + course info
      const { data: enrData, error: enrErr } = await supabase
        .from("lms_enrollments")
        .select(`
          status,
          progress_pct,
          due_date,
          lms_courses ( title, category, description, is_mandatory, estimated_minutes )
        `)
        .eq("id", enrollmentId)
        .eq("user_id", user.id)
        .single();

      if (enrErr) throw enrErr;
      setEnrollment(enrData as unknown as EnrollmentDetail);

      // 2 — Modules for this course
      const { data: modData, error: modErr } = await supabase
        .from("lms_modules")
        .select("id, title, description, sort_order")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (modErr) throw modErr;
      const rawModules = (modData ?? []) as { id: string; title: string; description: string | null; sort_order: number }[];

      if (rawModules.length === 0) {
        setModules([]);
        return;
      }

      // 3 — All lessons for these modules
      const moduleIds = rawModules.map(m => m.id);
      const { data: lesData, error: lesErr } = await supabase
        .from("lms_lessons")
        .select("id, title, content_type, sort_order, module_id")
        .in("module_id", moduleIds)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (lesErr) throw lesErr;
      const rawLessons = (lesData ?? []) as { id: string; title: string; content_type: string; sort_order: number; module_id: string }[];

      // 4 — Group lessons into modules
      const lessonsByModule: Record<string, Lesson[]> = {};
      for (const l of rawLessons) {
        if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
        lessonsByModule[l.module_id].push({ id: l.id, title: l.title, content_type: l.content_type, sort_order: l.sort_order });
      }

      const built: Module[] = rawModules.map(m => ({
        id:          m.id,
        title:       m.title,
        description: m.description,
        sort_order:  m.sort_order,
        lessons:     lessonsByModule[m.id] ?? [],
      }));

      setModules(built);
      // Auto-expand first module with lessons
      const first = built.find(m => m.lessons.length > 0);
      if (first) setExpanded(new Set([first.id]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load course.");
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, courseId, user?.id]);

  useEffect(() => { load(); }, [load]);

  function toggleModule(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const course      = enrollment?.lms_courses ?? null;
  const statusColor = STATUS_COLOR[enrollment?.status ?? ""] ?? colors.textMuted;
  const dueLabel    = dueDaysLabel(enrollment?.due_date ?? null);
  const isOverdue   = dueLabel?.startsWith("Overdue");
  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading course…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn't load course</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Course hero card */}
          <View style={styles.heroCard}>
            {/* Status + due */}
            <View style={styles.heroMeta}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {STATUS_LABEL[enrollment?.status ?? ""] ?? enrollment?.status}
                </Text>
                {course?.is_mandatory && (
                  <View style={styles.mandatoryBadge}>
                    <Text style={styles.mandatoryText}>Required</Text>
                  </View>
                )}
              </View>
              {dueLabel && (
                <Text style={[styles.dueText, isOverdue && styles.dueOverdue]}>{dueLabel}</Text>
              )}
            </View>

            {/* Meta row */}
            <View style={styles.metaRow}>
              {course?.category && (
                <View style={styles.chip}><Text style={styles.chipText}>{course.category}</Text></View>
              )}
              {course?.estimated_minutes ? (
                <View style={styles.chip}><Text style={styles.chipText}>⏱ {course.estimated_minutes} min</Text></View>
              ) : null}
              {totalLessons > 0 && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>📖 {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}</Text>
                </View>
              )}
            </View>

            {/* Description */}
            {course?.description ? (
              <Text style={styles.description}>{course.description}</Text>
            ) : null}

            {/* Progress */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Your progress</Text>
                <Text style={[styles.progressPct, { color: statusColor }]}>
                  {enrollment?.progress_pct ?? 0}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width:           `${enrollment?.progress_pct ?? 0}%` as any,
                  backgroundColor: statusColor,
                }]} />
              </View>
            </View>
          </View>

          {/* Modules section */}
          {modules.length === 0 ? (
            <View style={styles.emptyModules}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={styles.emptyTitle}>Content coming soon</Text>
              <Text style={styles.emptyBody}>
                No lessons have been added to this course yet.{"\n"}Check back later.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                Course content · {modules.length} module{modules.length !== 1 ? "s" : ""}
              </Text>
              {modules.map((mod, idx) => {
                const open = expanded.has(mod.id);
                return (
                  <View key={mod.id} style={styles.moduleCard}>
                    <TouchableOpacity
                      style={styles.moduleHeader}
                      onPress={() => toggleModule(mod.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.moduleIndex}>
                        <Text style={styles.moduleIndexText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.moduleTitleWrap}>
                        <Text style={styles.moduleTitle}>{mod.title}</Text>
                        {mod.lessons.length > 0 && (
                          <Text style={styles.lessonCount}>
                            {mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
                    </TouchableOpacity>

                    {open && (
                      <View style={styles.lessonList}>
                        {mod.lessons.length === 0 ? (
                          <Text style={styles.noLessonsText}>No lessons yet</Text>
                        ) : (
                          mod.lessons.map((lesson, lIdx) => (
                            <TouchableOpacity
                              key={lesson.id}
                              style={[styles.lessonRow, lIdx === mod.lessons.length - 1 && styles.lessonRowLast]}
                              onPress={() => navigation.navigate("LessonView", {
                                lessonId:    lesson.id,
                                lessonTitle: lesson.title,
                                moduleTitle: mod.title,
                              })}
                              activeOpacity={0.7}
                            >
                              <View style={styles.lessonIcon}>
                                <Text style={styles.lessonIconText}>
                                  {lesson.content_type === "text" ? "📄" : "▶️"}
                                </Text>
                              </View>
                              <Text style={styles.lessonTitle} numberOfLines={2}>
                                {lesson.title}
                              </Text>
                              <Text style={styles.lessonChevron}>›</Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: colors.background },
  scroll:         { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText:    { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  errorIcon:      { fontSize: 36, marginBottom: spacing.sm },
  errorTitle:     { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  errorBody:      { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  retryBtn:       { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.sm },
  retryText:      { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },

  heroCard:       { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadow.card, marginBottom: spacing.md },
  heroMeta:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  statusLeft:     { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statusDot:      { width: 7, height: 7, borderRadius: radius.full },
  statusText:     { fontSize: font.sizes.xs, fontWeight: "700" },
  mandatoryBadge: { backgroundColor: "#FEF3C7", borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  mandatoryText:  { fontSize: font.sizes.xs, fontWeight: "700", color: "#92400E" },
  dueText:        { fontSize: font.sizes.xs, color: colors.textMuted },
  dueOverdue:     { color: colors.danger, fontWeight: "700" },
  metaRow:        { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  chip:           { backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  chipText:       { fontSize: font.sizes.xs, color: colors.textSecondary },
  description:    { fontSize: font.sizes.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  progressSection:{ marginTop: 4 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel:  { fontSize: font.sizes.xs, color: colors.textMuted },
  progressPct:    { fontSize: font.sizes.xs, fontWeight: "700" },
  progressTrack:  { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden" },
  progressFill:   { height: "100%", borderRadius: radius.full },

  emptyModules:   { alignItems: "center", paddingTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon:      { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle:     { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:      { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4, textAlign: "center", lineHeight: 20 },

  sectionTitle:   { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },

  moduleCard:     { backgroundColor: colors.card, borderRadius: radius.md, ...shadow.card, marginBottom: spacing.sm, overflow: "hidden" },
  moduleHeader:   { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm },
  moduleIndex:    { width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  moduleIndexText:{ fontSize: font.sizes.xs, fontWeight: "800", color: colors.primary },
  moduleTitleWrap:{ flex: 1 },
  moduleTitle:    { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  lessonCount:    { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },
  chevron:        { fontSize: 10, color: colors.textMuted },

  lessonList:     { borderTopWidth: 1, borderTopColor: colors.border },
  noLessonsText:  { padding: spacing.md, fontSize: font.sizes.sm, color: colors.textMuted, textAlign: "center" },
  lessonRow:      { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 12, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  lessonRowLast:  { borderBottomWidth: 0 },
  lessonIcon:     { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  lessonIconText: { fontSize: 14 },
  lessonTitle:    { flex: 1, fontSize: font.sizes.sm, color: colors.text },
  lessonChevron:  { fontSize: 18, color: colors.textMuted },
});
