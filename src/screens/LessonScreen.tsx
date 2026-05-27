import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  Pressable, Image,
} from "react-native";
import { SafeAreaView }                          from "react-native-safe-area-context";
import Markdown                                  from "react-native-markdown-display";
import { Ionicons }                              from "@expo/vector-icons";
import type { NativeStackScreenProps }           from "@react-navigation/native-stack";
import { supabase }                              from "../lib/supabase";
import { useAuth }                               from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";
import type { TrainingStackParamList }           from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LessonData {
  id:               string;
  title:            string;
  content_type:     string;
  content_body:     string | null;
  duration_seconds: number | null;
  image_url:        string | null;
  image_alt:        string | null;
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
        .select("id, title, content_type, content_body, duration_seconds, image_url, image_alt")
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

      const { count, error: countErr } = await supabase
        .from("lms_progress")
        .select("id", { count: "exact", head: true })
        .eq("enrollment_id", enrollmentId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .is("deleted_at", null);
      if (countErr) throw countErr;

      const completed = count ?? 0;
      const newPct    = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
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
      console.warn("markComplete error:", e);
    } finally {
      setCompleting(false);
    }
  }, [user?.id, lessonId, enrollmentId, companyId, totalLessons, completing, isCompleted]);

  const typeLabel = lesson?.content_type === "text" ? "Reading" : "Video";
  const typeIcon: React.ComponentProps<typeof Ionicons>["name"] =
    lesson?.content_type === "text" ? "document-text-outline" : "play-circle-outline";

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading lesson…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load lesson</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : lesson ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Breadcrumb */}
            <View style={styles.breadcrumbRow}>
              <Ionicons name="layers-outline" size={12} color={colors.textMuted} />
              <Text style={styles.breadcrumb} numberOfLines={1}>{moduleTitle}</Text>
            </View>

            {/* Lesson header */}
            <View style={styles.lessonHeader}>
              <View style={[styles.lessonTypeIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={typeIcon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lessonTypeLabel}>{typeLabel}</Text>
                {lesson.duration_seconds ? (
                  <Text style={styles.durationLabel}>
                    {formatDuration(lesson.duration_seconds)}
                  </Text>
                ) : null}
              </View>
              {isCompleted && (
                <View style={styles.completedChip}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                  <Text style={styles.completedChipText}>Done</Text>
                </View>
              )}
            </View>

            {/* Lesson banner image (optional) */}
            {lesson.image_url ? (
              <View style={styles.lessonBannerWrap}>
                <Image
                  source={{ uri: lesson.image_url }}
                  style={styles.lessonBanner}
                  resizeMode="cover"
                  accessibilityLabel={lesson.image_alt ?? undefined}
                  accessibilityIgnoresInvertColors
                />
              </View>
            ) : null}

            {/* Content */}
            {lesson.content_body ? (
              <View style={styles.contentCard}>
                <Markdown style={mdStyles}>{lesson.content_body}</Markdown>
              </View>
            ) : (
              <View style={styles.noContent}>
                <View style={styles.noContentIconWrap}>
                  <Ionicons name="document-outline" size={28} color={colors.textMuted} />
                </View>
                <Text style={styles.noContentTitle}>Content not available</Text>
                <Text style={styles.noContentBody}>
                  This lesson has no content yet.{"\n"}Check back later.
                </Text>
              </View>
            )}

            {/* Bottom spacer so footer doesn't cover content */}
            <View style={{ height: 96 }} />
          </ScrollView>

          {/* ── Footer action ─────────────────────────────────────────── */}
          <View style={styles.footer}>
            {isCompleted ? (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.completedText}>Lesson complete</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.completeBtn,
                  completing && styles.completeBtnDisabled,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={markComplete}
                accessibilityRole="button"
                disabled={completing}
              >
                {completing ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <View style={styles.completeBtnInner}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                    <Text style={styles.completeBtnText}>Mark as complete</Text>
                  </View>
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
  safe:         { flex: 1, backgroundColor: colors.background },
  scroll:       { paddingHorizontal: spacing.md, paddingTop: spacing.md },

  // Center states
  center:         { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText:    { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  errorIconWrap:  { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  errorTitle:     { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  errorBody:      { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  retryBtn:       { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md },
  retryText:      { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },

  // Breadcrumb
  breadcrumbRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: spacing.sm },
  breadcrumb:    { fontSize: font.sizes.xs, color: colors.textMuted, flex: 1 },

  // Lesson header card
  lessonHeader:    { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, ...shadow.card },
  lessonTypeIcon:  { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  lessonTypeLabel: { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  durationLabel:   { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },
  completedChip:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.successLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  completedChipText: { fontSize: font.sizes.xs, fontWeight: "700", color: colors.success },

  // Lesson banner image
  lessonBannerWrap: { borderRadius: radius.xl, overflow: "hidden", marginBottom: spacing.md, ...shadow.xs },
  lessonBanner:     { width: "100%", height: 180 },

  // Content
  contentCard:      { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, ...shadow.xs },

  // Empty content
  noContent:         { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.xs },
  noContentIconWrap: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", ...shadow.xs },
  noContentTitle:    { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  noContentBody:     { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },

  // Footer
  footer:           {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    ...shadow.xs,
  },
  completeBtn:         { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: "center", ...shadow.button },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnInner:    { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  completeBtnText:     { color: colors.white, fontSize: font.sizes.base, fontWeight: "700" },
  completedBadge:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.successLight, borderRadius: radius.lg, paddingVertical: 15, borderWidth: 1, borderColor: colors.success + "30" },
  completedText:       { color: colors.success, fontSize: font.sizes.base, fontWeight: "700" },
});

// ─── Markdown styles ──────────────────────────────────────────────────────────

const mdStyles = StyleSheet.create({
  body:         { fontSize: font.sizes.base, color: colors.text, lineHeight: 28 },
  heading1:     { fontSize: font.sizes.lg,   fontWeight: "800", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm, lineHeight: 28 },
  heading2:     { fontSize: font.sizes.md,   fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  heading3:     { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xs },
  paragraph:    { marginBottom: spacing.sm, fontSize: font.sizes.base, color: colors.text, lineHeight: 28 },
  strong:       { fontWeight: "700" },
  em:           { fontStyle: "italic" },
  bullet_list:  { marginBottom: spacing.sm },
  ordered_list: { marginBottom: spacing.sm },
  list_item:    { marginBottom: 6, fontSize: font.sizes.base, color: colors.text, lineHeight: 26 },
  code_inline:  { backgroundColor: colors.background, borderRadius: 4, paddingHorizontal: 5, fontFamily: "monospace", fontSize: font.sizes.sm, color: colors.primaryDark },
  code_block:   { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  blockquote:   { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.sm, marginLeft: 0, marginBottom: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.xs },
  hr:           { borderBottomWidth: 1, borderBottomColor: colors.border, marginVertical: spacing.md },
  link:         { color: colors.primary, textDecorationLine: "underline" },
});
