import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView }                          from "react-native-safe-area-context";
import Markdown                                  from "react-native-markdown-display";
import type { NativeStackScreenProps }           from "@react-navigation/native-stack";
import { supabase }                              from "../lib/supabase";
import { useAuth }                               from "../auth/AuthContext";
import { colors, spacing, radius, font }         from "../lib/theme";
import type { TrainingStackParamList }           from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LessonData {
  id:               string;
  title:            string;
  content_type:     string;
  content_body:     string | null;
  duration_seconds: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m} min${s > 0 ? ` ${s}s` : ""}` : `${s}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<TrainingStackParamList, "LessonView">;

export default function LessonScreen({ route }: Props) {
  const { lessonId, moduleTitle, enrollmentId, companyId, totalLessons } = route.params;
  const { user } = useAuth();

  const [lesson,      setLesson]      = useState<LessonData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completing,  setCompleting]  = useState(false);
  const startedRef                    = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("lms_lessons")
        .select("id, title, content_type, content_body, duration_seconds")
        .eq("id", lessonId)
        .single();

      if (qErr) throw qErr;
      setLesson(data as LessonData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lesson.");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  // Load existing progress state
  const loadProgress = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("lms_progress")
      .select("status")
      .eq("enrollment_id", enrollmentId)
      .eq("lesson_id", lessonId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (data?.status === "completed") setIsCompleted(true);
  }, [lessonId, enrollmentId, user?.id]);

  useEffect(() => {
    load();
    loadProgress();
  }, [load, loadProgress]);

  // Mark as in_progress on first open (once)
  useEffect(() => {
    if (!user?.id || !lesson || startedRef.current || isCompleted) return;
    startedRef.current = true;
    const now = new Date().toISOString();
    supabase
      .from("lms_progress")
      .upsert(
        {
          user_id:       user.id,
          lesson_id:     lessonId,
          enrollment_id: enrollmentId,
          company_id:    companyId,
          status:        "in_progress",
          started_at:    now,
        },
        { onConflict: "company_id,user_id,lesson_id", ignoreDuplicates: true }
      )
      .then(() => {});
  }, [lesson, user?.id, lessonId, enrollmentId, companyId, isCompleted]);

  const markComplete = useCallback(async () => {
    if (!user?.id || completing || isCompleted) return;
    setCompleting(true);
    try {
      const now = new Date().toISOString();

      // 1 — Upsert progress row as completed
      const { error: progErr } = await supabase
        .from("lms_progress")
        .upsert(
          {
            user_id:        user.id,
            lesson_id:      lessonId,
            enrollment_id:  enrollmentId,
            company_id:     companyId,
            status:         "completed",
            completion_pct: 100,
            completed_at:   now,
            started_at:     now,
          },
          { onConflict: "company_id,user_id,lesson_id" }
        );
      if (progErr) throw progErr;

      // 2 — Count how many lessons are now completed for this enrollment
      const { count, error: countErr } = await supabase
        .from("lms_progress")
        .select("id", { count: "exact", head: true })
        .eq("enrollment_id", enrollmentId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .is("deleted_at", null);
      if (countErr) throw countErr;

      const completed = count ?? 0;
      const newPct    = totalLessons > 0
        ? Math.round((completed / totalLessons) * 100)
        : 0;

      // 3 — Update enrollment progress_pct (and status if fully done)
      const newStatus = newPct >= 100 ? "completed" : "in_progress";
      const patch: Record<string, unknown> = { progress_pct: newPct, status: newStatus };
      if (newPct >= 100) patch.completed_at = now;

      await supabase
        .from("lms_enrollments")
        .update(patch)
        .eq("id", enrollmentId)
        .eq("user_id", user.id);

      setIsCompleted(true);
    } catch (e) {
      // silently fail — UI stays interactable
      console.warn("markComplete error:", e);
    } finally {
      setCompleting(false);
    }
  }, [user?.id, lessonId, enrollmentId, companyId, totalLessons, completing, isCompleted]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading lesson…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn't load lesson</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : lesson ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Module breadcrumb */}
            <Text style={styles.breadcrumb}>{moduleTitle}</Text>

            {/* Meta chips */}
            <View style={styles.metaRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {lesson.content_type === "text" ? "📄 Reading" : "▶️ Video"}
                </Text>
              </View>
              {lesson.duration_seconds ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>⏱ {formatDuration(lesson.duration_seconds)}</Text>
                </View>
              ) : null}
              {isCompleted && (
                <View style={[styles.chip, styles.chipDone]}>
                  <Text style={[styles.chipText, styles.chipTextDone]}>✓ Completed</Text>
                </View>
              )}
            </View>

            {/* Content */}
            {lesson.content_body ? (
              <View style={styles.contentCard}>
                <Markdown style={mdStyles}>{lesson.content_body}</Markdown>
              </View>
            ) : (
              <View style={styles.noContent}>
                <Text style={styles.noContentIcon}>📭</Text>
                <Text style={styles.noContentTitle}>Content not available</Text>
                <Text style={styles.noContentBody}>
                  This lesson has no content yet.{"\n"}Check back later.
                </Text>
              </View>
            )}

            {/* Bottom spacer so FAB doesn't cover content */}
            <View style={{ height: 90 }} />
          </ScrollView>

          {/* Mark complete / completed footer */}
          <View style={styles.footer}>
            {isCompleted ? (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>✓ Lesson complete</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.completeBtn, completing && styles.completeBtnDisabled, pressed && { opacity: 0.85 }]}
                onPress={markComplete}
                accessibilityRole="button"
                disabled={completing}
              >
                {completing ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.completeBtnText}>Mark as complete</Text>
                )}
              </Pressable>
            )}
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.background },
  scroll:           { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  center:           { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText:      { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  errorIcon:        { fontSize: 36, marginBottom: spacing.sm },
  errorTitle:       { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  errorBody:        { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  retryBtn:         { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.sm },
  retryText:        { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },

  breadcrumb:       { fontSize: font.sizes.xs, color: colors.textMuted, marginBottom: spacing.xs },
  metaRow:          { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  chip:             { backgroundColor: colors.card, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  chipDone:         { backgroundColor: colors.success + "15", borderColor: colors.success + "40" },
  chipText:         { fontSize: font.sizes.xs, color: colors.textSecondary },
  chipTextDone:     { color: colors.success, fontWeight: "700" },

  contentCard:      { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },

  noContent:        { alignItems: "center", paddingTop: spacing.xxl },
  noContentIcon:    { fontSize: 40, marginBottom: spacing.sm },
  noContentTitle:   { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  noContentBody:    { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4, textAlign: "center", lineHeight: 20 },

  footer:           { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  completeBtn:      { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText:  { color: colors.white, fontSize: font.sizes.base, fontWeight: "700" },
  completedBadge:   { backgroundColor: colors.success + "15", borderRadius: radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.success + "40" },
  completedText:    { color: colors.success, fontSize: font.sizes.base, fontWeight: "700" },
});

// ─── Markdown styles ──────────────────────────────────────────────────────────

const mdStyles = StyleSheet.create({
  body:             { fontSize: font.sizes.base, color: colors.text, lineHeight: 26 },
  heading1:         { fontSize: font.sizes.lg,  fontWeight: "800", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  heading2:         { fontSize: font.sizes.md,  fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  heading3:         { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xs },
  paragraph:        { marginBottom: spacing.sm, fontSize: font.sizes.base, color: colors.text, lineHeight: 26 },
  strong:           { fontWeight: "700" },
  em:               { fontStyle: "italic" },
  bullet_list:      { marginBottom: spacing.sm },
  ordered_list:     { marginBottom: spacing.sm },
  list_item:        { marginBottom: 4, fontSize: font.sizes.base, color: colors.text, lineHeight: 24 },
  code_inline:      { backgroundColor: colors.background, borderRadius: 4, paddingHorizontal: 4, fontFamily: "monospace", fontSize: font.sizes.sm, color: colors.primaryDark },
  code_block:       { backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  blockquote:       { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.sm, marginLeft: 0, marginBottom: spacing.sm },
  hr:               { borderBottomWidth: 1, borderBottomColor: colors.border, marginVertical: spacing.md },
  link:             { color: colors.primary, textDecorationLine: "underline" },
});
