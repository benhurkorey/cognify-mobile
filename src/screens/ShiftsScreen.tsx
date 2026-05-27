import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons }     from "@expo/vector-icons";
import { supabase }     from "../lib/supabase";
import { useAuth }      from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Shift {
  id:         string;
  company_id: string;
  shift_date: string;
  start_time: string;
  end_time:   string;
  role_label: string | null;
  location:   string | null;
  status:     string;
  notes:      string | null;
}

interface AttendanceRecord {
  id:                string;
  attendance_status: "not_started" | "in_progress" | "on_break" | "completed";
  clock_in_at:       string | null;
  clock_out_at:      string | null;
  worked_minutes:    number | null;
  created_at:        string;
}

interface AttendanceHistoryItem {
  id:                string;
  attendance_status: string;
  clock_in_at:       string | null;
  clock_out_at:      string | null;
  worked_minutes:    number | null;
  hr_roster_shifts:  { shift_date: string; start_time: string; end_time: string } | null;
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

function formatElapsed(startIso: string): string {
  const mins = Math.floor((Date.now() - new Date(startIso).getTime()) / 60000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatWorkedMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  published: { color: colors.success,  label: "Confirmed" },
  draft:     { color: colors.warning,  label: "Pending"   },
  cancelled: { color: colors.danger,   label: "Cancelled" },
};

const ATTENDANCE_STATUS_META: Record<string, { color: string; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  not_started: { color: colors.textMuted,  label: "Not started", icon: "time-outline"              },
  in_progress: { color: colors.primary,    label: "Clocked in",  icon: "radio-button-on-outline"   },
  on_break:    { color: colors.warning,    label: "On break",    icon: "cafe-outline"              },
  completed:   { color: colors.success,    label: "Completed",   icon: "checkmark-circle-outline"  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftsScreen() {
  const { user } = useAuth();

  // Shift list state
  const [shifts,   setShifts]   = useState<Shift[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(0);

  // Clock in/out state
  const [todayShift,    setTodayShift]    = useState<Shift | null>(null);
  const [attendance,    setAttendance]    = useState<AttendanceRecord | null>(null);
  const [clockLoading,  setClockLoading]  = useState(false);
  const [, setTick] = useState(0); // force re-render for elapsed timer

  // Attendance history
  const [attendanceHistory,      setAttendanceHistory]      = useState<AttendanceHistoryItem[]>([]);
  const [attendanceHistoryLoading, setAttendanceHistoryLoading] = useState(false);

  // ── Timer for elapsed display ──────────────────────────────────
  useEffect(() => {
    if (attendance?.attendance_status !== "in_progress") return;
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, [attendance?.attendance_status]);

  // ── Load shifts ───────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const from = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);
      const to   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      const { data, error: qErr } = await supabase
        .from("hr_roster_shifts")
        .select("id, company_id, shift_date, start_time, end_time, role_label, location, status, notes")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .order("shift_date", { ascending: true });

      if (qErr) throw qErr;
      const rows = (data ?? []) as Shift[];
      setShifts(rows);

      const todayStr    = new Date().toISOString().slice(0, 10);
      const upcomingIdx = rows.findIndex((s) => s.shift_date >= todayStr);
      setSelected(upcomingIdx >= 0 ? upcomingIdx : 0);

      // Find today's shift for clock in/out
      const todayShiftData = rows.find(s => s.shift_date === todayStr) ?? null;
      setTodayShift(todayShiftData);
      if (todayShiftData) {
        loadAttendance(todayShiftData.id);
      } else {
        setAttendance(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shifts.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // ── Load today's attendance ───────────────────────────────────
  async function loadAttendance(shiftId: string) {
    if (!user?.id) return;
    const { data } = await supabase
      .from("hr_attendance")
      .select("id, attendance_status, clock_in_at, clock_out_at, worked_minutes, created_at")
      .eq("shift_id", shiftId)
      .eq("user_id", user.id)
      .maybeSingle();
    setAttendance((data ?? null) as AttendanceRecord | null);
  }

  // ── Load attendance history ───────────────────────────────────
  const loadAttendanceHistory = useCallback(async () => {
    if (!user?.id) return;
    setAttendanceHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("hr_attendance")
        .select("id, attendance_status, clock_in_at, clock_out_at, worked_minutes, hr_roster_shifts(shift_date, start_time, end_time)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(7);
      setAttendanceHistory((data ?? []) as unknown as AttendanceHistoryItem[]);
    } finally {
      setAttendanceHistoryLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAttendanceHistory(); }, [loadAttendanceHistory]);

  // ── Clock In ──────────────────────────────────────────────────
  async function clockIn() {
    if (!user?.id || !todayShift) return;
    setClockLoading(true);
    try {
      const { data, error: insertErr } = await supabase
        .from("hr_attendance")
        .insert({
          company_id:        todayShift.company_id,
          shift_id:          todayShift.id,
          user_id:           user.id,
          attendance_status: "in_progress",
          clock_in_at:       new Date().toISOString(),
        })
        .select("id, attendance_status, clock_in_at, clock_out_at, worked_minutes, created_at")
        .single();

      if (insertErr) throw insertErr;
      setAttendance(data as AttendanceRecord);
      loadAttendanceHistory();
    } catch (e: any) {
      if (e?.code === "23505") {
        // Already clocked in — reload
        loadAttendance(todayShift.id);
      } else {
        Alert.alert("Clock In Failed", e instanceof Error ? e.message : "Could not clock in. Please try again.");
      }
    } finally {
      setClockLoading(false);
    }
  }

  // ── Clock Out ─────────────────────────────────────────────────
  async function clockOut() {
    if (!attendance?.clock_in_at || !user?.id) return;
    const workedMins = Math.max(
      0,
      Math.floor((Date.now() - new Date(attendance.clock_in_at).getTime()) / 60000)
    );
    setClockLoading(true);
    try {
      const { data, error: updateErr } = await supabase
        .from("hr_attendance")
        .update({
          attendance_status: "completed",
          clock_out_at:      new Date().toISOString(),
          worked_minutes:    workedMins,
        })
        .eq("id", attendance.id)
        .eq("user_id", user.id)
        .select("id, attendance_status, clock_in_at, clock_out_at, worked_minutes, created_at")
        .single();

      if (updateErr) throw updateErr;
      setAttendance(data as AttendanceRecord);
      loadAttendanceHistory();
    } catch (e) {
      Alert.alert("Clock Out Failed", e instanceof Error ? e.message : "Could not clock out. Please try again.");
    } finally {
      setClockLoading(false);
    }
  }

  const todayStr   = new Date().toISOString().slice(0, 10);
  const upcoming   = shifts.filter(s => s.shift_date >= todayStr);
  const totalHours = upcoming.reduce((acc, s) => acc + durationHours(s.start_time, s.end_time), 0);
  const selectedShift = shifts[selected] ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>My Shifts</Text>
            <Text style={styles.pageSub}>Next 30 days</Text>
          </View>
          <TouchableOpacity onPress={load} style={styles.refreshBtn} disabled={loading}>
            <Ionicons name="refresh-outline" size={20} color={loading ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={load}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={styles.errorBannerText}>{error} — Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* ── Clock In / Out card ───────────────────────────────── */}
        {!loading && todayShift && (
          <ClockCard
            shift={todayShift}
            attendance={attendance}
            loading={clockLoading}
            onClockIn={clockIn}
            onClockOut={clockOut}
          />
        )}

        {/* ── Loading ───────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your shifts…</Text>
          </View>
        ) : shifts.length === 0 ? (

          /* ── Empty state ────────────────────────────────────── */
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
            {/* ── Summary stats ──────────────────────────────────── */}
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

            {/* ── Day picker ─────────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayRow}
            >
              {shifts.map((s, i) => {
                const active  = selected === i;
                const meta    = STATUS_META[s.status] ?? STATUS_META.published;
                const isToday = s.shift_date === todayStr;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSelected(i)}
                    style={[styles.dayBtn, active && styles.dayBtnActive]}
                    activeOpacity={0.8}
                  >
                    {isToday && !active && <View style={styles.todayDot} />}
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

            {/* ── Selected shift detail ───────────────────────────── */}
            {selectedShift && (
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailDate}>{formatDate(selectedShift.shift_date)}</Text>
                    <Text style={styles.detailDay}>{dayLabel(selectedShift.shift_date)}</Text>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: (STATUS_META[selectedShift.status]?.color ?? colors.primary) + "18",
                  }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_META[selectedShift.status]?.color ?? colors.primary }]} />
                    <Text style={[styles.statusBadgeText, { color: STATUS_META[selectedShift.status]?.color ?? colors.primary }]}>
                      {STATUS_META[selectedShift.status]?.label ?? selectedShift.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.timeBlock}>
                  <View style={styles.timeBlockLeft}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.timeText}>
                      {formatTime(selectedShift.start_time)} – {formatTime(selectedShift.end_time)}
                    </Text>
                  </View>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>
                      {durationHours(selectedShift.start_time, selectedShift.end_time)}h
                    </Text>
                  </View>
                </View>

                {selectedShift.role_label && (
                  <DetailRow icon="briefcase-outline" label="Role" value={selectedShift.role_label} />
                )}
                {selectedShift.location && (
                  <DetailRow icon="location-outline" label="Location" value={selectedShift.location} />
                )}
                {selectedShift.notes && (
                  <DetailRow icon="document-text-outline" label="Notes" value={selectedShift.notes} />
                )}
              </View>
            )}

            {/* ── All shifts list ─────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All scheduled shifts</Text>
              <View style={styles.shiftList}>
                {shifts.map((s, idx) => {
                  const meta   = STATUS_META[s.status] ?? STATUS_META.published;
                  const isLast = idx === shifts.length - 1;
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

        {/* ── Attendance Summary ───────────────────────────────── */}
        <AttendanceSummary
          history={attendanceHistory}
          loading={attendanceHistoryLoading}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ClockCard ────────────────────────────────────────────────────────────────

function ClockCard({
  shift, attendance, loading, onClockIn, onClockOut,
}: {
  shift:       Shift;
  attendance:  AttendanceRecord | null;
  loading:     boolean;
  onClockIn:   () => void;
  onClockOut:  () => void;
}) {
  const status  = attendance?.attendance_status ?? "not_started";
  const meta    = ATTENDANCE_STATUS_META[status] ?? ATTENDANCE_STATUS_META.not_started;
  const canIn   = status === "not_started";
  const canOut  = status === "in_progress";

  return (
    <View style={clockStyles.card}>
      {/* Top row */}
      <View style={clockStyles.topRow}>
        <View style={clockStyles.topLeft}>
          <View style={[clockStyles.statusDot, { backgroundColor: meta.color }]} />
          <Text style={[clockStyles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={clockStyles.shiftTime}>
          {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
        </Text>
      </View>

      <Text style={clockStyles.title}>Today's Shift</Text>
      {shift.role_label && (
        <Text style={clockStyles.role}>{shift.role_label}</Text>
      )}

      {/* Elapsed time (while clocked in) */}
      {status === "in_progress" && attendance?.clock_in_at && (
        <View style={clockStyles.elapsedRow}>
          <Ionicons name="timer-outline" size={14} color={colors.primary} />
          <Text style={clockStyles.elapsedText}>
            {formatElapsed(attendance.clock_in_at)} elapsed
          </Text>
        </View>
      )}

      {/* Worked time (after completion) */}
      {status === "completed" && attendance?.worked_minutes != null && (
        <View style={clockStyles.elapsedRow}>
          <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
          <Text style={[clockStyles.elapsedText, { color: colors.success }]}>
            {formatWorkedMinutes(attendance.worked_minutes)} worked
          </Text>
        </View>
      )}

      {/* Action button */}
      {(canIn || canOut) && (
        <TouchableOpacity
          style={[clockStyles.btn, canOut && clockStyles.btnOut]}
          onPress={canIn ? onClockIn : onClockOut}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons
                name={canIn ? "log-in-outline" : "log-out-outline"}
                size={17}
                color={colors.white}
              />
              <Text style={clockStyles.btnText}>
                {canIn ? "Clock In" : "Clock Out"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const clockStyles = StyleSheet.create({
  card:         { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.card, borderRadius: radius.xxl, padding: spacing.md, ...shadow.md, borderWidth: 1, borderColor: colors.borderLight },
  topRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  topLeft:      { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  statusLabel:  { fontSize: font.sizes.xs, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  shiftTime:    { fontSize: font.sizes.xs, color: colors.textSecondary, fontWeight: "600" },
  title:        { fontSize: font.sizes.md, fontWeight: "800", color: colors.text, marginBottom: 2 },
  role:         { fontSize: font.sizes.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  elapsedRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, alignSelf: "flex-start" },
  elapsedText:  { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },
  btn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, marginTop: 4, ...shadow.button },
  btnOut:       { backgroundColor: colors.danger, ...Platform_shadow(colors.danger) },
  btnText:      { fontSize: font.sizes.base, fontWeight: "700", color: colors.white },
});

// platform-safe colored shadow helper
import { Platform } from "react-native";
function Platform_shadow(color: string) {
  return Platform.select({
    web: { boxShadow: `0 4px 14px ${color}55` } as object,
    default: { shadowColor: color, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 },
  });
}

// ─── AttendanceSummary ────────────────────────────────────────────────────────

function AttendanceSummary({
  history, loading,
}: { history: AttendanceHistoryItem[]; loading: boolean }) {
  if (!loading && history.length === 0) return null;

  return (
    <View style={attStyles.section}>
      <Text style={attStyles.sectionTitle}>Attendance Summary</Text>

      {loading ? (
        <View style={attStyles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={attStyles.loadingText}>Loading attendance…</Text>
        </View>
      ) : (
        <View style={attStyles.list}>
          {history.map((item, idx) => {
            const shift   = item.hr_roster_shifts;
            const meta    = ATTENDANCE_STATUS_META[item.attendance_status] ?? ATTENDANCE_STATUS_META.not_started;
            const isLast  = idx === history.length - 1;
            const dateStr = shift ? formatDate(shift.shift_date) : "Unknown date";
            return (
              <View key={item.id} style={[attStyles.row, !isLast && attStyles.rowBorder]}>
                <View style={[attStyles.iconWrap, { backgroundColor: meta.color + "14" }]}>
                  <Ionicons name={meta.icon} size={15} color={meta.color} />
                </View>
                <View style={attStyles.rowContent}>
                  <Text style={attStyles.rowDate}>{dateStr}</Text>
                  {shift && (
                    <Text style={attStyles.rowTime}>
                      {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                    </Text>
                  )}
                </View>
                <View style={attStyles.rowRight}>
                  {item.worked_minutes != null && item.worked_minutes > 0 ? (
                    <Text style={attStyles.workedHours}>{formatWorkedMinutes(item.worked_minutes)}</Text>
                  ) : null}
                  <View style={[attStyles.statusBadge, { backgroundColor: meta.color + "18" }]}>
                    <Text style={[attStyles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const attStyles = StyleSheet.create({
  section:     { paddingHorizontal: spacing.md, marginBottom: spacing.xxl },
  sectionTitle: { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  loadingRow:  { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  loadingText: { fontSize: font.sizes.sm, color: colors.textSecondary },
  list:        { backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: spacing.md, ...shadow.card },
  row:         { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 13 },
  rowBorder:   { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  iconWrap:    { width: 32, height: 32, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  rowContent:  { flex: 1 },
  rowDate:     { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  rowTime:     { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 1 },
  rowRight:    { alignItems: "flex-end", gap: 4 },
  workedHours: { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  statusText:  { fontSize: 10, fontWeight: "700" },
});

// ─── DetailRow sub-component ──────────────────────────────────────────────────

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
  summaryRow:      { flexDirection: "row", paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  summaryCard:     { flex: 1, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, alignItems: "center", gap: spacing.xs, ...shadow.card },
  summaryIconWrap: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  summaryValue:    { fontSize: font.sizes.xl, fontWeight: "800" },
  summaryLabel:    { fontSize: 10, color: colors.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },

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
  section:        { paddingHorizontal: spacing.md, marginBottom: spacing.md },
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
