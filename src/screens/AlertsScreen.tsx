import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons }     from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ALERTS = [
  { id: "1", type: "urgent",  title: "Training overdue: Fire Safety",   body: "Complete Fire Safety training immediately — it was due 3 days ago.",   time: "2h ago",    read: false },
  { id: "2", type: "warning", title: "Shift change: Thursday 5 Jun",    body: "Your shift has been moved from 9am to 12pm. Location unchanged.",       time: "5h ago",    read: false },
  { id: "3", type: "info",    title: "New policy: Workplace conduct",   body: "Please review the updated workplace conduct policy in the HR section.", time: "1 day ago",  read: true  },
  { id: "4", type: "success", title: "Manual Handling — certificate!",  body: "Congratulations! Your Manual Handling certificate has been issued.",    time: "2 days ago", read: true  },
  { id: "5", type: "warning", title: "Leave request: approved",         body: "Your annual leave for 10–14 Jun has been approved by Sarah Chen.",      time: "3 days ago", read: true  },
  { id: "6", type: "info",    title: "New message from HR",             body: "Your employment contract has been updated. Please review and sign.",    time: "5 days ago", read: true  },
];

type AlertType = "urgent" | "warning" | "info" | "success";
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TYPE_CONFIG: Record<AlertType, {
  iconName: IoniconName;
  iconColor: string;
  iconBg: string;
  accentColor: string;
}> = {
  urgent:  { iconName: "alert-circle",         iconColor: colors.danger,  iconBg: colors.dangerLight,  accentColor: colors.danger  },
  warning: { iconName: "warning-outline",       iconColor: colors.warning, iconBg: colors.warningLight, accentColor: colors.warning },
  info:    { iconName: "information-circle-outline", iconColor: colors.info, iconBg: colors.infoLight,   accentColor: colors.info    },
  success: { iconName: "checkmark-circle",      iconColor: colors.success, iconBg: colors.successLight, accentColor: colors.success },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  const unread = alerts.filter(a => !a.read).length;

  function markAllRead() {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  }

  function markRead(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>

      {/* ── Header ──────────────────────────────────────────────────── */}
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

        {/* Unread section */}
        {alerts.some(a => !a.read) && (
          <>
            <Text style={styles.groupLabel}>New</Text>
            {alerts.filter(a => !a.read).map(alert => (
              <AlertCard key={alert.id} alert={alert} onPress={() => markRead(alert.id)} />
            ))}
          </>
        )}

        {/* Read section */}
        {alerts.some(a => a.read) && (
          <>
            <Text style={[styles.groupLabel, { marginTop: spacing.sm }]}>Earlier</Text>
            {alerts.filter(a => a.read).map(alert => (
              <AlertCard key={alert.id} alert={alert} onPress={() => markRead(alert.id)} />
            ))}
          </>
        )}

        {alerts.length === 0 && (
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

// ─── AlertCard sub-component ──────────────────────────────────────────────────

function AlertCard({
  alert,
  onPress,
}: {
  alert: typeof MOCK_ALERTS[number];
  onPress: () => void;
}) {
  const cfg = TYPE_CONFIG[alert.type as AlertType] ?? TYPE_CONFIG.info;

  return (
    <TouchableOpacity
      style={[styles.alertCard, alert.read && styles.alertCardRead]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Left accent stripe */}
      <View style={[styles.alertAccent, { backgroundColor: cfg.accentColor }]} />

      <View style={styles.alertInner}>
        {/* Icon circle */}
        <View style={[styles.alertIconWrap, { backgroundColor: cfg.iconBg }]}>
          <Ionicons name={cfg.iconName} size={18} color={cfg.iconColor} />
        </View>

        {/* Content */}
        <View style={styles.alertContent}>
          <View style={styles.alertTitleRow}>
            <Text
              style={[styles.alertTitle, alert.read && styles.alertTitleRead]}
              numberOfLines={1}
            >
              {alert.title}
            </Text>
            <Text style={styles.alertTime}>{alert.time}</Text>
          </View>
          <Text style={styles.alertBody} numberOfLines={2}>{alert.body}</Text>
        </View>

        {/* Unread indicator */}
        {!alert.read && (
          <View style={[styles.unreadDot, { backgroundColor: cfg.accentColor }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },

  // Header
  headerArea:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
  pageTitle:   { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:     { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  markAllBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.full },
  markAllText: { fontSize: font.sizes.xs, fontWeight: "700", color: colors.primary },

  // List
  list:       { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },
  groupLabel: { fontSize: 10, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.xs, marginTop: 4 },

  // Alert card
  alertCard:      {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadow.card,
  },
  alertCardRead:  { opacity: 0.65 },
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
