import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView }  from "react-native-safe-area-context";
import { Ionicons }      from "@expo/vector-icons";
import { useAuth }       from "../auth/AuthContext";
import { supabase }      from "../lib/supabase";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingSummary {
  total:    number;
  pending:  number;
  complete: number;
  nextDue:  { title: string; dueDate: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dueDaysLabel(iso: string): string {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff < 0)   return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, color, icon, loading,
}: { label: string; value: string; color: string; icon: IoniconName; loading?: boolean }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + "14" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={color} style={{ marginVertical: 2 }} />
      ) : (
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface QuickLinkProps {
  icon: IoniconName;
  label: string;
  color: string;
}
function QuickLink({ icon, label, color }: QuickLinkProps) {
  return (
    <TouchableOpacity style={styles.quickLink} activeOpacity={0.75}>
      <View style={[styles.quickIconWrap, { backgroundColor: color + "14" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
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
        lms_courses:  { title: string } | null;
      }>;

      const total    = rows.length;
      const complete = rows.filter(r => r.status === "completed").length;
      const pending  = total - complete;
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

  const completionPct = summary && summary.total > 0
    ? Math.round((summary.complete / summary.total) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Header banner ─────────────────────────────────────────── */}
        <View style={styles.headerBanner}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.greetingName}>{firstName}</Text>
            <Text style={styles.subGreeting}>Here's your training at a glance</Text>
          </View>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{firstName[0]?.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── Completion progress strip ──────────────────────────────── */}
        {!loading && summary && summary.total > 0 && (
          <View style={styles.progressStrip}>
            <View style={styles.progressStripTop}>
              <Text style={styles.progressStripLabel}>Overall completion</Text>
              <Text style={styles.progressStripPct}>{completionPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completionPct}%` as any }]} />
            </View>
          </View>
        )}

        {/* ── Error banner ───────────────────────────────────────────── */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={load}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.errorBannerText}>{error} — Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* ── Stats row ─────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard label="Assigned" value={loading ? "…" : String(summary?.total ?? 0)}   color={colors.primary} icon="layers-outline"    loading={loading} />
          <StatCard label="Pending"  value={loading ? "…" : String(summary?.pending ?? 0)}  color={colors.warning} icon="time-outline"      loading={loading} />
          <StatCard label="Done"     value={loading ? "…" : String(summary?.complete ?? 0)} color={colors.success} icon="checkmark-circle-outline" loading={loading} />
        </View>

        {/* ── Quick access ──────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick access</Text>
        </View>
        <View style={styles.quickRow}>
          <QuickLink icon="book-outline"          label="Training" color={colors.primary} />
          <QuickLink icon="calendar-outline"      label="Shifts"   color={colors.accent}  />
          <QuickLink icon="person-circle-outline" label="HR"       color={colors.success} />
          <QuickLink icon="notifications-outline" label="Alerts"   color={colors.warning} />
        </View>

        {/* ── Upcoming training ─────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming training</Text>
        </View>

        {loading ? (
          <View style={styles.upcomingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : !summary || summary.total === 0 ? (
          <View style={[styles.upcomingCard, styles.emptyCard]}>
            <Ionicons name="book-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No courses assigned yet</Text>
            <Text style={styles.emptyBody}>Your manager will assign courses here.</Text>
          </View>
        ) : !summary.nextDue ? (
          <View style={[styles.upcomingCard, styles.successCard]}>
            <View style={styles.successRow}>
              <View style={styles.successIconWrap}>
                <Ionicons name="trophy-outline" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>All caught up! 🎉</Text>
                <Text style={styles.successMeta}>
                  {summary.complete} of {summary.total} course{summary.total !== 1 ? "s" : ""} complete
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.upcomingCard}>
            {/* Next due item */}
            <UpcomingItem
              title={summary.nextDue.title}
              meta={dueDaysLabel(summary.nextDue.dueDate) + " · Training"}
              isOverdue={dueDaysLabel(summary.nextDue.dueDate).startsWith("Overdue")}
              dotColor={dueDaysLabel(summary.nextDue.dueDate).startsWith("Overdue") ? colors.danger : colors.warning}
              icon="time-outline"
            />
            {summary.pending > 1 && (
              <>
                <View style={styles.divider} />
                <UpcomingItem
                  title={`${summary.pending - 1} more course${summary.pending - 1 !== 1 ? "s" : ""} pending`}
                  meta="See Training tab for full list"
                  dotColor={colors.primary}
                  icon="layers-outline"
                />
              </>
            )}
          </View>
        )}

        {/* ── Sign out ──────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={15} color={colors.textMuted} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function UpcomingItem({ title, meta, dotColor, icon, isOverdue }: {
  title: string; meta: string; dotColor: string;
  icon: IoniconName; isOverdue?: boolean;
}) {
  return (
    <View style={upStyles.row}>
      <View style={[upStyles.iconWrap, { backgroundColor: dotColor + "15" }]}>
        <Ionicons name={icon} size={15} color={dotColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={upStyles.title} numberOfLines={2}>{title}</Text>
        <Text style={[upStyles.meta, isOverdue && upStyles.overdue]}>{meta}</Text>
      </View>
    </View>
  );
}

const upStyles = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  iconWrap: { width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: 1 },
  title:    { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text, lineHeight: 18 },
  meta:     { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },
  overdue:  { color: colors.danger, fontWeight: "700" },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
  container: { paddingBottom: spacing.xxl },

  // Header banner
  headerBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 4,
  },
  headerLeft:   { flex: 1 },
  greeting:     { fontSize: font.sizes.sm, color: "rgba(255,255,255,0.75)", fontWeight: "500" },
  greetingName: { fontSize: font.sizes.xl, fontWeight: "800", color: colors.white, marginTop: 1 },
  subGreeting:  { fontSize: font.sizes.xs, color: "rgba(255,255,255,0.60)", marginTop: 4 },
  avatarWrap:   { paddingTop: 2 },
  avatar:       {
    width: 46, height: 46, borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { color: colors.white, fontSize: font.sizes.md, fontWeight: "700" },

  // Progress strip
  progressStrip: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: -spacing.md,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadow.md,
    marginBottom: spacing.md,
  },
  progressStripTop:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressStripLabel: { fontSize: font.sizes.xs, fontWeight: "600", color: colors.textSecondary },
  progressStripPct:  { fontSize: font.sizes.xs, fontWeight: "800", color: colors.primary },
  progressTrack:     { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden" },
  progressFill:      { height: "100%", borderRadius: radius.full, backgroundColor: colors.primary },

  // Error
  errorBanner:     {
    flexDirection: "row", gap: spacing.xs, alignItems: "center",
    backgroundColor: colors.dangerLight, borderRadius: radius.md,
    padding: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: "#FECACA",
  },
  errorBannerText: { flex: 1, fontSize: font.sizes.sm, color: colors.danger },

  // Stats
  statsRow:  { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  statCard:  {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.sm + 2, ...shadow.card, gap: 4,
  },
  statIconWrap: { width: 28, height: 28, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue: { fontSize: font.sizes.lg, fontWeight: "800", lineHeight: 24 },
  statLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },

  // Section titles
  sectionHeader: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  sectionTitle:  { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },

  // Quick links
  quickRow:     { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  quickLink:    { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, alignItems: "center", gap: spacing.xs, ...shadow.card },
  quickIconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  quickLabel:   { fontSize: 10, color: colors.textSecondary, fontWeight: "600", textAlign: "center" },

  // Upcoming card
  upcomingCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, ...shadow.card, marginHorizontal: spacing.md, marginBottom: spacing.md },
  emptyCard:    { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.xs },
  emptyTitle:   { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  emptyBody:    { fontSize: font.sizes.xs, color: colors.textMuted, textAlign: "center" },
  loadingText:  { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 4 },
  successCard:  { borderWidth: 1, borderColor: colors.successLight },
  successRow:   { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  successIconWrap: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.successLight, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  successMeta:  { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.border },

  // Sign out
  signOutBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md },
  signOutText: { fontSize: font.sizes.sm, color: colors.textMuted },
});
