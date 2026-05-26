import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth }      from "../auth/AuthContext";
import { supabase }     from "../lib/supabase";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingSummary {
  total:     number;
  pending:   number;
  complete:  number;
  nextDue:   { title: string; dueDate: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dueDaysLabel(iso: string): string {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, color, loading,
}: { label: string; value: string; color: string; loading?: boolean }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      {loading ? (
        <ActivityIndicator size="small" color={color} style={{ marginVertical: 4 }} />
      ) : (
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({ icon, label }: { icon: string; label: string }) {
  return (
    <TouchableOpacity style={styles.quickLink} activeOpacity={0.75}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  const [summary,  setSummary]  = useState<TrainingSummary | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "there";

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("lms_enrollments")
        .select("status, progress_pct, due_date, lms_courses(title)")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (qErr) throw qErr;

      const rows = (data ?? []) as unknown as Array<{
        status:       string;
        progress_pct: number;
        due_date:     string | null;
        lms_courses:  { title: string } | { title: string }[] | null;
      }>;

      const total    = rows.length;
      const complete = rows.filter(r => r.status === "completed").length;
      const pending  = total - complete;

      // First row with a due_date that isn't completed
      const nextRow  = rows.find(r => r.status !== "completed" && r.due_date);
      const nextDue  = nextRow
        ? { title: (nextRow.lms_courses as any)?.title ?? "Course", dueDate: nextRow.due_date! }
        : null;

      setSummary({ total, pending, complete, nextDue });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load summary.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>Here's your training at a glance</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{firstName[0]?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Error banner */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={load}>
            <Text style={styles.errorBannerText}>⚠️ {error} — Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Stats row — real data */}
        <View style={styles.statsRow}>
          <StatCard
            label="Assigned"
            value={loading ? "…" : String(summary?.total ?? 0)}
            color={colors.primary}
            loading={loading}
          />
          <StatCard
            label="Pending"
            value={loading ? "…" : String(summary?.pending ?? 0)}
            color={colors.warning}
            loading={loading}
          />
          <StatCard
            label="Complete"
            value={loading ? "…" : String(summary?.complete ?? 0)}
            color={colors.success}
            loading={loading}
          />
        </View>

        {/* Quick links */}
        <Text style={styles.sectionTitle}>Quick access</Text>
        <View style={styles.quickRow}>
          <QuickLink icon="📚" label="My Training" />
          <QuickLink icon="📅" label="My Shifts" />
          <QuickLink icon="👤" label="My HR" />
          <QuickLink icon="🔔" label="Alerts" />
        </View>

        {/* Next due course */}
        <Text style={styles.sectionTitle}>Upcoming training</Text>
        {loading ? (
          <View style={styles.upcomingCard}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !summary || summary.total === 0 ? (
          <View style={styles.upcomingCard}>
            <Text style={styles.emptyUpcoming}>No courses assigned yet.</Text>
          </View>
        ) : !summary.nextDue ? (
          <View style={styles.upcomingCard}>
            <View style={styles.upcomingRow}>
              <View style={[styles.upcomingDot, { backgroundColor: colors.success }]} />
              <View style={styles.upcomingText}>
                <Text style={styles.upcomingTitle}>All caught up! 🎉</Text>
                <Text style={styles.upcomingMeta}>
                  {summary.complete} of {summary.total} course{summary.total !== 1 ? "s" : ""} complete
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.upcomingCard}>
            {/* Next due */}
            <View style={styles.upcomingRow}>
              <View style={[styles.upcomingDot, {
                backgroundColor: dueDaysLabel(summary.nextDue.dueDate).startsWith("Overdue")
                  ? colors.danger : colors.warning,
              }]} />
              <View style={styles.upcomingText}>
                <Text style={styles.upcomingTitle} numberOfLines={2}>
                  {summary.nextDue.title}
                </Text>
                <Text style={[
                  styles.upcomingMeta,
                  dueDaysLabel(summary.nextDue.dueDate).startsWith("Overdue") && styles.upcomingOverdue,
                ]}>
                  {dueDaysLabel(summary.nextDue.dueDate)} · Training
                </Text>
              </View>
            </View>

            {/* Pending count summary */}
            {summary.pending > 1 && (
              <View style={styles.upcomingRow}>
                <View style={[styles.upcomingDot, { backgroundColor: colors.primary }]} />
                <View style={styles.upcomingText}>
                  <Text style={styles.upcomingTitle}>
                    {summary.pending - 1} more course{summary.pending - 1 !== 1 ? "s" : ""} pending
                  </Text>
                  <Text style={styles.upcomingMeta}>See Training tab for full list</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: colors.background },
  container:         { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  header:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.lg },
  greeting:          { fontSize: font.sizes.lg, fontWeight: "700", color: colors.text },
  subGreeting:       { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  avatar:            { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarLetter:      { color: colors.white, fontSize: font.sizes.md, fontWeight: "700" },
  errorBanner:       { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md },
  errorBannerText:   { fontSize: font.sizes.sm, color: colors.danger },
  statsRow:          { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statCard:          { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.card },
  statValue:         { fontSize: font.sizes.lg, fontWeight: "800" },
  statLabel:         { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  sectionTitle:      { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  quickRow:          { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  quickLink:         { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, alignItems: "center", gap: spacing.xs, ...shadow.card },
  quickIcon:         { fontSize: 22 },
  quickLabel:        { fontSize: font.sizes.xs, color: colors.textSecondary, fontWeight: "600", textAlign: "center" },
  upcomingCard:      { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.md, ...shadow.card, marginBottom: spacing.lg },
  upcomingRow:       { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  upcomingDot:       { width: 8, height: 8, borderRadius: radius.full, marginTop: 5 },
  upcomingText:      { flex: 1 },
  upcomingTitle:     { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text },
  upcomingMeta:      { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },
  upcomingOverdue:   { color: colors.danger, fontWeight: "700" },
  emptyUpcoming:     { fontSize: font.sizes.sm, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.sm },
  signOutBtn:        { alignItems: "center", paddingVertical: spacing.md },
  signOutText:       { fontSize: font.sizes.sm, color: colors.textMuted },
});
