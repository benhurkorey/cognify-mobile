import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase }     from "../lib/supabase";
import { useAuth }      from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Shift {
  id:         string;
  shift_date: string;
  start_time: string;
  end_time:   string;
  role_label: string | null;
  location:   string | null;
  status:     string;
  notes:      string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function formatTime(t: string): string {
  // t is "HH:MM:SS"
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour   = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function durationHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.round(((eh + em / 60) - (sh + sm / 60)) * 10) / 10;
}

function dayLabel(iso: string): string {
  const diff = Math.round(
    (new Date(iso + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime())
    / 86400000
  );
  if (diff === 0)  return "Today";
  if (diff === 1)  return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0)    return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  published: { color: colors.success,  label: "Confirmed" },
  draft:     { color: colors.warning,  label: "Pending"   },
  cancelled: { color: colors.danger,   label: "Cancelled" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftsScreen() {
  const { user }    = useAuth();
  const [shifts,    setShifts]    = useState<Shift[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [selected,  setSelected]  = useState<number>(0);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Query: own shifts, upcoming + recent (last 7 days → next 30 days)
      const from = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);
      const to   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      const { data, error: qErr } = await supabase
        .from("hr_roster_shifts")
        .select("id, shift_date, start_time, end_time, role_label, location, status, notes")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .order("shift_date", { ascending: true });

      if (qErr) throw qErr;
      setShifts((data ?? []) as Shift[]);
      // Auto-select first upcoming shift
      const todayStr = new Date().toISOString().slice(0, 10);
      const upcomingIdx = (data ?? []).findIndex((s: any) => s.shift_date >= todayStr);
      setSelected(upcomingIdx >= 0 ? upcomingIdx : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shifts.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Summary stats
  const todayStr    = new Date().toISOString().slice(0, 10);
  const upcoming    = shifts.filter(s => s.shift_date >= todayStr);
  const totalHours  = upcoming.reduce((acc, s) => acc + durationHours(s.start_time, s.end_time), 0);
  const selected_s  = shifts[selected] ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>My Shifts</Text>
          <Text style={styles.pageSub}>
            {loading ? "Loading…" : `Next 30 days`}
          </Text>
        </View>

        {/* Error */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={load}>
            <Text style={styles.errorBannerText}>⚠️ {error} — Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your shifts…</Text>
          </View>
        ) : shifts.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No shifts scheduled</Text>
            <Text style={styles.emptyBody}>
              You have no upcoming shifts in the next 30 days.{"\n"}Contact your manager if this looks wrong.
            </Text>
          </View>
        ) : (
          <>
            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  {upcoming.length}
                </Text>
                <Text style={styles.summaryLabel}>Upcoming</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  {Math.round(totalHours * 10) / 10}h
                </Text>
                <Text style={styles.summaryLabel}>Scheduled hrs</Text>
              </View>
            </View>

            {/* Horizontal shift selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayRow}
            >
              {shifts.map((s, i) => {
                const active = selected === i;
                const meta   = STATUS_META[s.status] ?? STATUS_META.published;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSelected(i)}
                    style={[styles.dayBtn, active && styles.dayBtnActive]}
                  >
                    <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>
                      {new Date(s.shift_date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short" })}
                    </Text>
                    <Text style={[styles.dayDate, active && styles.dayTextActive]}>
                      {new Date(s.shift_date + "T00:00:00").getDate()}
                    </Text>
                    <View style={[styles.shiftDot, {
                      backgroundColor: active ? colors.white : meta.color,
                    }]} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Selected shift detail */}
            {selected_s && (
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailDate}>{formatDate(selected_s.shift_date)}</Text>
                    <Text style={styles.detailDay}>{dayLabel(selected_s.shift_date)}</Text>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: (STATUS_META[selected_s.status]?.color ?? colors.primary) + "20",
                  }]}>
                    <Text style={[styles.statusBadgeText, {
                      color: STATUS_META[selected_s.status]?.color ?? colors.primary,
                    }]}>
                      {STATUS_META[selected_s.status]?.label ?? selected_s.status}
                    </Text>
                  </View>
                </View>

                {/* Time block */}
                <View style={styles.timeBlock}>
                  <Text style={styles.timeText}>
                    {formatTime(selected_s.start_time)} – {formatTime(selected_s.end_time)}
                  </Text>
                  <Text style={styles.durationText}>
                    {durationHours(selected_s.start_time, selected_s.end_time)}h
                  </Text>
                </View>

                {/* Detail rows */}
                {selected_s.role_label && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailIcon}>💼</Text>
                    <View>
                      <Text style={styles.detailRowLabel}>Role</Text>
                      <Text style={styles.detailRowValue}>{selected_s.role_label}</Text>
                    </View>
                  </View>
                )}
                {selected_s.location && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailIcon}>📍</Text>
                    <View>
                      <Text style={styles.detailRowLabel}>Location</Text>
                      <Text style={styles.detailRowValue}>{selected_s.location}</Text>
                    </View>
                  </View>
                )}
                {selected_s.notes && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailIcon}>📝</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailRowLabel}>Notes</Text>
                      <Text style={styles.detailRowValue}>{selected_s.notes}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* All shifts list */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All scheduled shifts</Text>
              {shifts.map(s => {
                const meta = STATUS_META[s.status] ?? STATUS_META.published;
                return (
                  <View key={s.id} style={styles.shiftRow}>
                    <View style={styles.shiftRowLeft}>
                      <Text style={styles.shiftRowDate}>{formatDate(s.shift_date)}</Text>
                      <Text style={styles.shiftRowTime}>
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </Text>
                      {s.location && (
                        <Text style={styles.shiftRowLocation}>{s.location}</Text>
                      )}
                    </View>
                    <View style={[styles.badge, { backgroundColor: meta.color + "20" }]}>
                      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.background },
  header:           { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pageTitle:        { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:          { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  errorBanner:      { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: radius.sm, padding: spacing.sm },
  errorBannerText:  { fontSize: font.sizes.sm, color: colors.danger },
  center:           { alignItems: "center", paddingTop: spacing.xxl },
  loadingText:      { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  emptyWrap:        { alignItems: "center", paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon:        { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle:       { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:        { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 20 },
  summaryRow:       { flexDirection: "row", paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  summaryCard:      { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: "center", ...shadow.card },
  summaryValue:     { fontSize: font.sizes.xl, fontWeight: "800" },
  summaryLabel:     { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  dayRow:           { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  dayBtn:           { width: 60, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.card, alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border },
  dayBtnActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  dayWeekday:       { fontSize: font.sizes.xs, fontWeight: "700", color: colors.textSecondary },
  dayDate:          { fontSize: font.sizes.md, fontWeight: "800", color: colors.text },
  dayTextActive:    { color: colors.white },
  shiftDot:         { width: 6, height: 6, borderRadius: radius.full },
  detailCard:       { marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card, marginBottom: spacing.lg },
  detailHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  detailDate:       { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  detailDay:        { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  statusBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusBadgeText:  { fontSize: font.sizes.xs, fontWeight: "700" },
  timeBlock:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  timeText:         { fontSize: font.sizes.md, fontWeight: "700", color: colors.primary },
  durationText:     { fontSize: font.sizes.sm, fontWeight: "600", color: colors.primary },
  detailRow:        { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  detailIcon:       { fontSize: 18, width: 26 },
  detailRowLabel:   { fontSize: font.sizes.xs, color: colors.textSecondary },
  detailRowValue:   { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text },
  section:          { paddingHorizontal: spacing.md, marginBottom: spacing.xxl },
  sectionTitle:     { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  shiftRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  shiftRowLeft:     { flex: 1 },
  shiftRowDate:     { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  shiftRowTime:     { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  shiftRowLocation: { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 1 },
  badge:            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeText:        { fontSize: font.sizes.xs, fontWeight: "700" },
});
