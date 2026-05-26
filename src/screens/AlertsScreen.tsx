import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

const MOCK_ALERTS = [
  { id: "1", type: "urgent", icon: "🚨", title: "Training overdue: Fire Safety",    body: "Complete Fire Safety training immediately — it was due 3 days ago.",    time: "2h ago",   read: false },
  { id: "2", type: "warning",icon: "⚠️", title: "Shift change: Thursday 5 Jun",    body: "Your shift has been moved from 9am to 12pm. Location unchanged.",        time: "5h ago",   read: false },
  { id: "3", type: "info",   icon: "📢", title: "New policy: Workplace conduct",   body: "Please review the updated workplace conduct policy in the HR section.",   time: "1 day ago", read: true  },
  { id: "4", type: "info",   icon: "🎉", title: "Manual Handling — certificate!",  body: "Congratulations! Your Manual Handling certificate has been issued.",      time: "2 days ago", read: true },
  { id: "5", type: "warning",icon: "📅", title: "Leave request: approved",         body: "Your annual leave for 10–14 Jun has been approved by Sarah Chen.",        time: "3 days ago", read: true },
  { id: "6", type: "info",   icon: "💬", title: "New message from HR",             body: "Your employment contract has been updated. Please review and sign.",      time: "5 days ago", read: true },
];

const TYPE_STYLE: Record<string, { bg: string; border: string; dot: string }> = {
  urgent:  { bg: "#FEF2F2", border: "#FECACA", dot: colors.danger  },
  warning: { bg: "#FFFBEB", border: "#FDE68A", dot: colors.warning },
  info:    { bg: colors.card, border: colors.border, dot: colors.primary },
};

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
      {/* Header */}
      <View style={styles.headerArea}>
        <View>
          <Text style={styles.pageTitle}>Alerts</Text>
          <Text style={styles.pageSub}>
            {unread > 0 ? `${unread} unread notification${unread !== 1 ? "s" : ""}` : "All caught up!"}
          </Text>
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {alerts.map(alert => {
          const style = TYPE_STYLE[alert.type];
          return (
            <TouchableOpacity
              key={alert.id}
              style={[
                styles.alertCard,
                { backgroundColor: style.bg, borderColor: style.border },
                alert.read && styles.alertCardRead,
              ]}
              onPress={() => markRead(alert.id)}
              activeOpacity={0.8}
            >
              <View style={styles.alertInner}>
                {/* Unread dot */}
                {!alert.read && <View style={[styles.unreadDot, { backgroundColor: style.dot }]} />}

                {/* Icon */}
                <Text style={styles.alertIcon}>{alert.icon}</Text>

                {/* Content */}
                <View style={styles.alertContent}>
                  <View style={styles.alertTitleRow}>
                    <Text style={[styles.alertTitle, alert.read && styles.alertTitleRead]}>
                      {alert.title}
                    </Text>
                    <Text style={styles.alertTime}>{alert.time}</Text>
                  </View>
                  <Text style={styles.alertBody} numberOfLines={2}>{alert.body}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {alerts.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No alerts</Text>
            <Text style={styles.emptyBody}>You're all caught up. Check back later.</Text>
          </View>
        )}

        <Text style={styles.footerNote}>Alerts are retained for 30 days.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.background },
  headerArea:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
  pageTitle:       { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:         { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  markAllBtn:      { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.sm },
  markAllText:     { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },
  list:            { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  alertCard:       { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, position: "relative" },
  alertCardRead:   { opacity: 0.7 },
  alertInner:      { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  unreadDot:       { position: "absolute", top: -4, right: -4, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.background },
  alertIcon:       { fontSize: 24, width: 32, marginTop: 2 },
  alertContent:    { flex: 1 },
  alertTitleRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.xs, marginBottom: 4 },
  alertTitle:      { flex: 1, fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  alertTitleRead:  { fontWeight: "600", color: colors.textSecondary },
  alertTime:       { fontSize: font.sizes.xs, color: colors.textMuted, flexShrink: 0 },
  alertBody:       { fontSize: font.sizes.sm, color: colors.textSecondary, lineHeight: 18 },
  empty:           { alignItems: "center", paddingTop: spacing.xxl },
  emptyIcon:       { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle:      { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  emptyBody:       { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 4 },
  footerNote:      { textAlign: "center", fontSize: font.sizes.xs, color: colors.textMuted, marginTop: spacing.lg },
});
