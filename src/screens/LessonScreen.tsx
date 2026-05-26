import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { SafeAreaView }                          from "react-native-safe-area-context";
import type { NativeStackScreenProps }           from "@react-navigation/native-stack";
import { supabase }                              from "../lib/supabase";
import { colors, spacing, radius, font }         from "../lib/theme";
import type { TrainingStackParamList }           from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LessonData {
  id:              string;
  title:           string;
  content_type:    string;
  content_body:    string | null;
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
  const { lessonId, moduleTitle } = route.params;

  const [lesson,  setLesson]  = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

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

  useEffect(() => { load(); }, [load]);

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
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : lesson ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Module breadcrumb */}
          <Text style={styles.breadcrumb}>{moduleTitle}</Text>

          {/* Meta row */}
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
          </View>

          {/* Content body */}
          {lesson.content_body ? (
            <View style={styles.contentCard}>
              <Text style={styles.contentText}>{lesson.content_body}</Text>
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

        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.background },
  scroll:           { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  center:           { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText:      { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  errorIcon:        { fontSize: 36, marginBottom: spacing.sm },
  errorTitle:       { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  errorBody:        { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  retryBtn:         { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.sm },
  retryText:        { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },

  breadcrumb:       { fontSize: font.sizes.xs, color: colors.textMuted, marginBottom: spacing.xs },
  metaRow:          { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  chip:             { backgroundColor: colors.card, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  chipText:         { fontSize: font.sizes.xs, color: colors.textSecondary },

  contentCard:      { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  contentText:      { fontSize: font.sizes.base, color: colors.text, lineHeight: 26 },

  noContent:        { alignItems: "center", paddingTop: spacing.xxl },
  noContentIcon:    { fontSize: 40, marginBottom: spacing.sm },
  noContentTitle:   { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  noContentBody:    { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4, textAlign: "center", lineHeight: 20 },
});
