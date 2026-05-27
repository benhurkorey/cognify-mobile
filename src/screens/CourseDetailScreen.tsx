import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView }                          from "react-native-safe-area-context";
import { Ionicons }                              from "@expo/vector-icons";
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
  company_id:   string;
  lms_courses: {
    title:             string;
    category:          string | null;
    description:       string | null;
    is_mandatory:      boolean;
    estimated_minutes: number | null;
    thumbnail_url:     string | null;
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

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const STATUS_ICON: Record<string, IoniconName> = {
  in_progress: "play-circle-outline",
  enrolled:    "ellipse-outline",
  completed:   "checkmark-circle",
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
  const { user } = useAuth();

  const [enrollment,       setEnrollment]       = useState<EnrollmentDetail | null>(null);
  const [modules,          setModules]           = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons]  = useState<Set<string>>(new Set());
  const [loading,          setLoading]           = useState(true);
  const [error,            setError]             = useState<string | null>(null);
  const [expanded,         setExpanded]          = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: enrData, error: enrErr } = await supabase
        .from("lms_enrollments")
        .select(`
          status, progress_pct, due_date, company_id,
          lms_courses ( title, category, description, is_mandatory, estimated_minutes, thumbnail_url )
        `)
        .eq("id", enrollmentId)
        .eq("user_id", user.id)
        .single();

      if (enrErr) throw enrErr;
      setEnrollment(enrData as unknown as EnrollmentDetail);

      const { data: modData, error: modErr } = await supabase
        .from("lms_modules")
        .select("id, title, description, sort_order")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (modErr) throw modErr;
      const rawModules = (modData ?? []) as { id: string; title: string; description: string | null; sort_order: number }[];

      if (rawModules.length === 0) { setModules([]); return; }

      const moduleIds = rawModules.map(m => m.id);
      const { data: lesData, error: lesErr } = await supabase
        .from("lms_lessons")
        .select("id, title, content_type, sort_order, module_id")
        .in("module_id", moduleIds)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (lesErr) throw lesErr;
      const rawLessons = (lesData ?? []) as { id: string; title: string; content_type: string; sort_order: number; module_id: string }[];

      const allLessonIds = rawLessons.map(l => l.id);
      if (allLessonIds.length > 0) {
        const { data: progData } = await supabase
          .from("lms_progress")
          .select("lesson_id, status")
          .eq("enrollment_id", enrollmentId)
          .eq("user_id", user.id)
          .in("lesson_id", allLessonIds)
          .is("deleted_at", null);

        const done = new Set<string>(
          (progData ?? [])
            .filter((p: any) => p.status === "completed")
            .map((p: any) => p.lesson_id as string)
        );
        setCompletedLessons(done);
      }

      const lessonsByModule: Record<string, Lesson[]> = {};
      for (const l of rawLessons) {
        if (!lessonsByModule[l.module_id]) lessonsByModule[l.module_id] = [];
        lessonsByModule[l.module_id].push({ id: l.id, title: l.title, content_type: l.content_type, sort_order: l.sort_order });
      }

      const built: Module[] = rawModules.map(m => ({
        id: m.id, title: m.title, description: m.description,
        sort_order: m.sort_order, lessons: lessonsByModule[m.id] ?? [],
      }));

      setModules(built);
      const first = built.find(m => m.lessons.length > 0);
      if (first) setExpanded(new Set([first.id]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load course.");
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, courseId, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return navigation.addListener("focus", () => {
      if (!loading) load();
    });
  }, [navigation, loading, load]);

  function toggleModule(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const course       = enrollment?.lms_courses ?? null;
  const statusColor  = STATUS_COLOR[enrollment?.status ?? ""] ?? colors.textMuted;
  const dueLabel     = dueDaysLabel(enrollment?.due_date ?? null);
  const isOverdue    = dueLabel?.startsWith("Overdue");
  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);
  const companyId    = enrollment?.company_id ?? "";
  const pct          = enrollment?.progress_pct ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading course…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load course</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero card ─────────────────────────────────────────────── */}
          <View style={styles.heroCard}>
            {/* Thumbnail banner */}
            {course?.thumbnail_url ? (
              <Image
                source={{ uri: course.thumbnail_url }}
                style={styles.heroThumb}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}

            {/* Card content with padding */}
            <View style={styles.heroBody}>
            {/* Status row */}
            <View style={styles.heroMeta}>
              <View style={[styles.statusPill, { backgroundColor: statusColor + "15" }]}>
                <Ionicons name={STATUS_ICON[enrollment?.status ?? ""] ?? "ellipse-outline"} size={12} color={statusColor} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {STATUS_LABEL[enrollment?.status ?? ""] ?? enrollment?.status}
                </Text>
              </View>
              <View style={styles.heroMetaRight}>
                {course?.is_mandatory && (
                  <View style={styles.mandatoryBadge}>
                    <Text style={styles.mandatoryText}>Required</Text>
                  </View>
                )}
                {dueLabel && (
                  <Text style={[styles.dueText, isOverdue && styles.dueOverdue]}>{dueLabel}</Text>
                )}
              </View>
            </View>

            {/* Title */}
            <Text style={styles.courseTitle}>{course?.title ?? "Course"}</Text>

            {/* Meta chips */}
            <View style={styles.metaRow}>
              {course?.category && (
                <View style={styles.chip}>
                  <Ionicons name="folder-outline" size={11} color={colors.textSecondary} />
                  <Text style={styles.chipText}>{course.category}</Text>
                </View>
              )}
              {course?.estimated_minutes ? (
                <View style={styles.chip}>
                  <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
                  <Text style={styles.chipText}>{course.estimated_minutes} min</Text>
                </View>
              ) : null}
              {totalLessons > 0 && (
                <View style={styles.chip}>
                  <Ionicons name="reader-outline" size={11} color={colors.textSecondary} />
                  <Text style={styles.chipText}>{totalLessons} lesson{totalLessons !== 1 ? "s" : ""}</Text>
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
                <Text style={[styles.progressPct, { color: statusColor }]}>{pct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: `${pct}%` as any,
                  backgroundColor: statusColor,
                }]} />
              </View>
              {totalLessons > 0 && (
                <Text style={styles.lessonProgress}>
                  {completedLessons.size} of {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} complete
                </Text>
              )}
            </View>
            </View>{/* end heroBody */}
          </View>

          {/* ── Modules ───────────────────────────────────────────────── */}
          {modules.length === 0 ? (
            <View style={styles.emptyModules}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="reader-outline" size={30} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Content coming soon</Text>
              <Text style={styles.emptyBody}>No lessons have been added yet. Check back later.</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Course content</Text>
                <Text style={styles.sectionSub}>{modules.length} module{modules.length !== 1 ? "s" : ""}</Text>
              </View>

              {modules.map((mod, idx) => {
                const open         = expanded.has(mod.id);
                const modCompleted = mod.lessons.filter(l => completedLessons.has(l.id)).length;
                const modTotal     = mod.lessons.length;
                const modDone      = modTotal > 0 && modCompleted === modTotal;

                return (
                  <View key={mod.id} style={styles.moduleCard}>
                    <Pressable
                      style={({ pressed }) => [styles.moduleHeader, pressed && { opacity: 0.75 }]}
                      onPress={() => toggleModule(mod.id)}
                      accessibilityRole="button"
                    >
                      <View style={[styles.moduleIndex, modDone && styles.moduleIndexDone]}>
                        {modDone
                          ? <Ionicons name="checkmark" size={13} color={colors.white} />
                          : <Text style={styles.moduleIndexText}>{idx + 1}</Text>
                        }
                      </View>
                      <View style={styles.moduleTitleWrap}>
                        <Text style={styles.moduleTitle} numberOfLines={1}>{mod.title}</Text>
                        {mod.lessons.length > 0 && (
                          <Text style={styles.lessonCount}>
                            {modCompleted}/{modTotal} lesson{modTotal !== 1 ? "s" : ""}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={open ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>

                    {open && (
                      <View style={styles.lessonList}>
                        {mod.lessons.length === 0 ? (
                          <Text style={styles.noLessonsText}>No lessons yet</Text>
                        ) : (
                          mod.lessons.map((lesson, lIdx) => {
                            const done = completedLessons.has(lesson.id);
                            const isLast = lIdx === mod.lessons.length - 1;
                            const lessonIcon: IoniconName = lesson.content_type === "text"
                              ? "document-text-outline"
                              : "play-circle-outline";

                            return (
                              <Pressable
                                key={lesson.id}
                                accessibilityRole="button"
                                onPress={() => navigation.navigate("LessonView", {
                                  lessonId:    lesson.id,
                                  lessonTitle: lesson.title,
                                  moduleTitle: mod.title,
                                  enrollmentId,
                                  companyId,
                                  totalLessons,
                                })}
                                style={({ pressed }) => [
                                  styles.lessonRow,
                                  !isLast && styles.lessonRowBorder,
                                  pressed && styles.lessonRowPressed,
                                ]}
                              >
                                <View style={[styles.lessonIcon, done && styles.lessonIconDone]}>
                                  {done
                                    ? <Ionicons name="checkmark" size={13} color={colors.success} />
                                    : <Ionicons name={lessonIcon} size={14} color={colors.textSecondary} />
                                  }
                                </View>
                                <Text
                                  style={[styles.lessonTitle, done && styles.lessonTitleDone]}
                                  numberOfLines={2}
                                >
                                  {lesson.title}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textXMuted} />
                              </Pressable>
                            );
                          })
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

  // Center states
  center:         { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText:    { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  errorIconWrap:  { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  errorTitle:     { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  errorBody:      { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  retryBtn:       { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md },
  retryText:      { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },

  // Hero card
  heroCard:         { backgroundColor: colors.card, borderRadius: radius.xxl, overflow: "hidden", ...shadow.card, marginBottom: spacing.md },
  heroThumb:        { width: "100%", height: 160 },
  heroBody:         { padding: spacing.md },
  heroMeta:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  statusPill:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  statusText:       { fontSize: 11, fontWeight: "700" },
  heroMetaRight:    { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  mandatoryBadge:   { backgroundColor: colors.warningLight, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3 },
  mandatoryText:    { fontSize: 10, fontWeight: "700", color: "#92400E" },
  dueText:          { fontSize: font.sizes.xs, color: colors.textMuted },
  dueOverdue:       { color: colors.danger, fontWeight: "700" },

  courseTitle:      { fontSize: font.sizes.lg, fontWeight: "800", color: colors.text, marginBottom: spacing.sm, lineHeight: 26 },

  metaRow:          { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  chip:             { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  chipText:         { fontSize: font.sizes.xs, color: colors.textSecondary },

  description:      { fontSize: font.sizes.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },

  progressSection:  { marginTop: spacing.xs },
  progressHeader:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel:    { fontSize: font.sizes.xs, fontWeight: "600", color: colors.textSecondary },
  progressPct:      { fontSize: font.sizes.xs, fontWeight: "800" },
  progressTrack:    { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden", marginBottom: 6 },
  progressFill:     { height: "100%", borderRadius: radius.full },
  lessonProgress:   { fontSize: font.sizes.xs, color: colors.textMuted },

  // Empty
  emptyModules:     { alignItems: "center", paddingTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIconWrap:    { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm, ...shadow.xs },
  emptyTitle:       { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:        { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4, textAlign: "center", lineHeight: 20 },

  // Section header
  sectionHeader:    { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: spacing.sm },
  sectionTitle:     { fontSize: font.sizes.base, fontWeight: "700", color: colors.text },
  sectionSub:       { fontSize: font.sizes.xs, color: colors.textMuted },

  // Module card
  moduleCard:       { backgroundColor: colors.card, borderRadius: radius.xl, ...shadow.card, marginBottom: spacing.sm, overflow: "hidden" },
  moduleHeader:     { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm },
  moduleIndex:      { width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  moduleIndexDone:  { backgroundColor: colors.success },
  moduleIndexText:  { fontSize: font.sizes.xs, fontWeight: "800", color: colors.primary },
  moduleTitleWrap:  { flex: 1 },
  moduleTitle:      { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  lessonCount:      { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },

  // Lesson rows
  lessonList:         { borderTopWidth: 1, borderTopColor: colors.border },
  noLessonsText:      { padding: spacing.md, fontSize: font.sizes.sm, color: colors.textMuted, textAlign: "center" },
  lessonRow:          { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 13, paddingHorizontal: spacing.md },
  lessonRowBorder:    { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  lessonRowPressed:   { backgroundColor: colors.surface },
  lessonIcon:         { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  lessonIconDone:     { backgroundColor: colors.successLight },
  lessonTitle:        { flex: 1, fontSize: font.sizes.sm, color: colors.text, fontWeight: "500", lineHeight: 18 },
  lessonTitleDone:    { color: colors.textMuted },
});
