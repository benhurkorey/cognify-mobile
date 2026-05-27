import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons }     from "@expo/vector-icons";
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
  const { user }   = useAuth();
  const [shifts,   setShifts]   = useState<Shift[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(0);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
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
      const todayStr    = new Date().toISOString().slice(0, 10);
      const upcomingIdx = (data ?? []).findIndex((s: any) => s.shift_date >= todayStr);
      setSelected(upcomingIdx >= 0 ? upcomingIdx : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shifts.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const todayStr   = new Date().toISOString().slice(0, 10);
  const upcoming   = shifts.filter(s => s.shift_date >= todayStr);
  const totalHours = upcoming.reduce((acc, s) => acc + durationHours(s.start_time, s.end_time), 0);
  const selected_s = shifts[selected] ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>My Shifts</Text>
            <Text style={styles.pageSub}>Next 30 days</Text>
          </View>
          <TouchableOpacity onPress={load} style={styles.refreshBtn} disabled={loading}>
            <Ionicons name="refresh-outline" size={20} color={loading ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={load}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={styles.errorBannerText}>{error} — Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your shifts…</Text>
          </View>
        ) : shifts.length === 0 ? (
          /* ── Empty state ────────────────────────────────────────────── */
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No shifts scheduled</Text>
            <Text style={styles.emptyBody}>
              You have no upcoming shifts in the next 30 days.{"\n"}Contact your manager if this looks wrong.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Summary stat cards ────────────────────────────────────── */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIconWrap, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{upcoming.length}</Text>
                <Text style={styles.summaryLabel}>Upcoming</Text>
              </View>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIconWrap, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="time-outline" size={16} color={colors.success} />
                </View>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  {Math.round(totalHours * 10) / 10}h
                </Text>
                <Text style={styles.summaryLabel}>Scheduled hrs</Text>
              </View>
            </View>

            {/* ── Day picker ────────────────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayRow}
            >
              {shifts.map((s, i) => {
                const active = selected === i;
                const meta   = STATUS_META[s.status] ?? STATUS_META.published;
                const isToday = s.shift_date === todayStr;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSelected(i)}
                    style={[styles.dayBtn, active && styles.dayBtnActive]}
                    activeOpacity={0.8}
                  >
                    {isToday && !active && (
                      <View style={styles.todayDot} />
                    )}
                    <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>
                      {new Date(s.shift_date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short" })}
                    </Text>
                    <Text style={[styles.dayDate, active && styles.dayTextActive]}>
                      {new Date(s.shift_date + "T00:00:00").getDate()}
                    </Text>
                    <View style={[styles.shiftDot, { backgroundColor: active ? colors.white + "90" : meta.color }]} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Selected shift detail ─────────────────────────────────── */}
            {selected_s && (
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailDate}>{formatDate(selected_s.shift_date)}</Text>
                    <Text style={styles.detailDay}>{dayLabel(selected_s.shift_date)}</Text>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: (STATUS_META[selected_s.status]?.color ?? colors.primary) + "18",
                  }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_META[selected_s.status]?.color ?? colors.primary }]} />
                    <Text style={[styles.statusBadgeText, {
                      color: STATUS_META[selected_s.status]?.color ?? colors.primary,
                    }]}>
                      {STATUS_META[selected_s.status]?.label ?? selected_s.status}
                    </Text>
                  </View>
                </View>

                {/* Time block */}
                <View style={styles.timeBlock}>
                  <View style={styles.timeBlockLeft}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.timeText}>
                      {formatTime(selected_s.start_time)} – {formatTime(selected_s.end_time)}
                    </Text>
                  </View>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>
                      {durationHours(selected_s.start_time, selected_s.end_time)}h
                    </Text>
                  </View>
                </View>

                {/* Detail rows */}
                {selected_s.role_label && (
                  <DetailRow icon="briefcase-outline" label="Role" value={selected_s.role_label} />
                )}
                {selected_s.location && (
                  <DetailRow icon="location-outline" label="Location" value={selected_s.location} />
                )}
                {selected_s.notes && (
                  <DetailRow icon="document-text-outline" label="Notes" value={selected_s.notes} />
                )}
              </View>
            )}

            {/* ── All shifts list ───────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All scheduled shifts</Text>
              <View style={styles.shiftList}>
                {shifts.map((s, idx) => {
                  const meta    = STATUS_META[s.status] ?? STATUS_META.published;
                  const isLast  = idx === shifts.length - 1;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.shiftRow, !isLast && styles.shiftRowBorder]}
                      onPress={() => setSelected(idx)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.shiftRowLeft}>
                        <Text style={styles.shiftRowDate}>{formatDate(s.shift_date)}</Text>
                        <Text style={styles.shiftRowTime}>
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </Text>
                        {s.location && (
                          <Text style={styles.shiftRowLocation}>{s.location}</Text>
                        )}
                      </View>
                      <View style={[styles.badge, { backgroundColor: meta.color + "18" }]}>
                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Detail row sub-component ─────────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function DetailRow({ icon, label, value }: { icon: IoniconName; label: string; value: string }) {
  return (
    <View style={drStyles.row}>
      <View style={drStyles.iconWrap}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={drStyles.label}>{label}</Text>
        <Text style={drStyles.value}>{value}</Text>
      </View>
    </View>
  );
}
const drStyles = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.borderLight },
  iconWrap: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", marginTop: 1 },
  label:    { fontSize: font.sizes.xs, color: colors.textMuted, marginBottom: 2 },
  value:    { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.background },

  // Header
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pageTitle:        { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:          { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  refreshBtn:       { padding: 6, marginTop: 2 },

  // Error
  errorBanner:      { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: "#FECACA", borderRadius: radius.md, padding: spacing.sm },
  errorBannerText:  { flex: 1, fontSize: font.sizes.sm, color: colors.danger },

  // Loading / empty
  center:       { alignItems: "center", paddingTop: spacing.xxl },
  loadingText:  { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  emptyWrap:    { alignItems: "center", paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIconWrap: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm, ...shadow.xs },
  emptyTitle:   { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:    { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 20 },

  // Summary
  summaryRow:     { flexDirection: "row", paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  summaryCard:    { flex: 1, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, alignItems: "center", gap: spacing.xs, ...shadow.card },
  summaryIconWrap: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  summaryValue:   { fontSize: font.sizes.xl, fontWeight: "800" },
  summaryLabel:   { fontSize: 10, color: colors.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },

  // Day picker
  dayRow:         { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  dayBtn:         { width: 58, paddingVertical: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.card, alignItems: "center", gap: 4, borderWidth: 1.5, borderColor: colors.border },
  dayBtnActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  dayWeekday:     { fontSize: 10, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase" },
  dayDate:        { fontSize: font.sizes.md, fontWeight: "800", color: colors.text },
  dayTextActive:  { color: colors.white },
  todayDot:       { position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  shiftDot:       { width: 6, height: 6, borderRadius: radius.full },

  // Detail card
  detailCard:     { marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.xxl, padding: spacing.md, ...shadow.md, marginBottom: spacing.lg },
  detailHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  detailDate:     { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  detailDay:      { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  statusBadge:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: font.sizes.xs, fontWeight: "700" },

  timeBlock:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: 4 },
  timeBlockLeft:  { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeText:       { fontSize: font.sizes.md, fontWeight: "700", color: colors.primary },
  durationBadge:  { backgroundColor: colors.primary + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  durationText:   { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },

  // All shifts list
  section:        { paddingHorizontal: spacing.md, marginBottom: spacing.xxl },
  sectionTitle:   { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  shiftList:      { backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: spacing.md, ...shadow.card },
  shiftRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13 },
  shiftRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  shiftRowLeft:   { flex: 1 },
  shiftRowDate:   { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  shiftRowTime:   { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  shiftRowLocation: { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 1 },
  badge:          { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full },
  badgeText:      { fontSize: font.sizes.xs, fontWeight: "700" },
});
