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

interface Notification {
  id:         string;
  type:       string;
  title:      string;
  message:    string;
  is_read:    boolean;
  created_at: string;
}

type AlertType = "urgent" | "warning" | "info" | "success";
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<AlertType, {
  iconName: IoniconName; iconColor: string; iconBg: string; accentColor: string;
}> = {
  urgent:  { iconName: "alert-circle",              iconColor: colors.danger,  iconBg: colors.dangerLight,  accentColor: colors.danger  },
  warning: { iconName: "warning-outline",            iconColor: colors.warning, iconBg: colors.warningLight, accentColor: colors.warning },
  info:    { iconName: "information-circle-outline", iconColor: colors.info,    iconBg: colors.infoLight,    accentColor: colors.info    },
  success: { iconName: "checkmark-circle",           iconColor: colors.success, iconBg: colors.successLight, accentColor: colors.success },
};

function mapType(type: string): AlertType {
  if (type === "quiz_failed")                                                  return "urgent";
  if (type === "due_date_reminder")                                            return "warning";
  if (["course_completed", "certificate_issued", "quiz_passed"].includes(type)) return "success";
  return "info";
}

function relativeTime(iso: string): string {
  const mins  = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 2)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("lms_notifications")
        .select("id, type, title, message, is_read, created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (qErr) throw qErr;
      setNotifications((data ?? []) as Notification[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load + realtime subscription
  useEffect(() => {
    load();
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  "lms_notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user?.id]);

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase
      .from("lms_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user?.id ?? "");
  }

  async function markAllRead() {
    const ids = notifications.filter(n => !n.is_read).map(n => n.id);
    if (!ids.length) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase
      .from("lms_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", ids)
      .eq("user_id", user?.id ?? "");
  }

  const unread = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.headerArea}>
        <View>
          <Text style={styles.pageTitle}>Alerts</Text>
          <Text style={styles.pageSub}>
            {unread > 0
              ? `${unread} unread notification${unread !== 1 ? "s" : ""}`
              : "You're all caught up"}
          </Text>
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.8}>
            <Ionicons name="checkmark-done-outline" size={14} color={colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>

        {/* Error */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={load}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{error} — Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Unread */}
        {notifications.some(n => !n.is_read) && (
          <>
            <Text style={styles.groupLabel}>New</Text>
            {notifications.filter(n => !n.is_read).map(n => (
              <AlertCard key={n.id} notification={n} onPress={() => markRead(n.id)} />
            ))}
          </>
        )}

        {/* Read */}
        {notifications.some(n => n.is_read) && (
          <>
            <Text style={[styles.groupLabel, { marginTop: spacing.sm }]}>Earlier</Text>
            {notifications.filter(n => n.is_read).map(n => (
              <AlertCard key={n.id} notification={n} onPress={() => {}} />
            ))}
          </>
        )}

        {/* Empty */}
        {notifications.length === 0 && !error && (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={30} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No alerts</Text>
            <Text style={styles.emptyBody}>You're all caught up. Check back later.</Text>
          </View>
        )}

        <Text style={styles.footerNote}>Alerts are retained for 30 days.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── AlertCard ────────────────────────────────────────────────────────────────

function AlertCard({
  notification, onPress,
}: { notification: Notification; onPress: () => void }) {
  const alertType = mapType(notification.type);
  const cfg = TYPE_CONFIG[alertType];

  return (
    <TouchableOpacity
      style={[styles.alertCard, notification.is_read && styles.alertCardRead]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.alertAccent, { backgroundColor: cfg.accentColor }]} />
      <View style={styles.alertInner}>
        <View style={[styles.alertIconWrap, { backgroundColor: cfg.iconBg }]}>
          <Ionicons name={cfg.iconName} size={18} color={cfg.iconColor} />
        </View>
        <View style={styles.alertContent}>
          <View style={styles.alertTitleRow}>
            <Text
              style={[styles.alertTitle, notification.is_read && styles.alertTitleRead]}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            <Text style={styles.alertTime}>{relativeTime(notification.created_at)}</Text>
          </View>
          <Text style={styles.alertBody} numberOfLines={2}>{notification.message}</Text>
        </View>
        {!notification.is_read && (
          <View style={[styles.unreadDot, { backgroundColor: cfg.accentColor }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header
  headerArea:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
  pageTitle:   { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:     { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  markAllBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.full },
  markAllText: { fontSize: font.sizes.xs, fontWeight: "700", color: colors.primary },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: "#FECACA" },
  errorText:   { flex: 1, fontSize: font.sizes.sm, color: colors.danger },

  // List
  list:       { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },
  groupLabel: { fontSize: 10, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.xs, marginTop: 4 },

  // Alert card
  alertCard:      { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.xl, overflow: "hidden", ...shadow.card },
  alertCardRead:  { opacity: 0.62 },
  alertAccent:    { width: 3 },
  alertInner:     { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", padding: spacing.md, paddingLeft: spacing.sm },
  alertIconWrap:  { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  alertContent:   { flex: 1 },
  alertTitleRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.xs, marginBottom: 4 },
  alertTitle:     { flex: 1, fontSize: font.sizes.sm, fontWeight: "700", color: colors.text, lineHeight: 18 },
  alertTitleRead: { fontWeight: "600", color: colors.textSecondary },
  alertTime:      { fontSize: font.sizes.xs, color: colors.textMuted, flexShrink: 0, marginTop: 1 },
  alertBody:      { fontSize: font.sizes.sm, color: colors.textSecondary, lineHeight: 18 },
  unreadDot:      { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },

  // Empty
  empty:         { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.xs },
  emptyIconWrap: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs, ...shadow.xs },
  emptyTitle:    { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:     { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },

  footerNote: { textAlign: "center", fontSize: font.sizes.xs, color: colors.textMuted, marginTop: spacing.md },
});
