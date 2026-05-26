import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView }               from "react-native-safe-area-context";
import { useAuth }                    from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "there";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>Here's your day at a glance</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{firstName[0]?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard label="Trainings due"  value="3"  color={colors.warning} />
          <StatCard label="Next shift"     value="Today" color={colors.primary} />
          <StatCard label="Unread alerts"  value="1"  color={colors.danger} />
        </View>

        {/* Quick links */}
        <Text style={styles.sectionTitle}>Quick access</Text>
        <View style={styles.quickRow}>
          <QuickLink icon="📚" label="My Training" />
          <QuickLink icon="📅" label="My Shifts" />
          <QuickLink icon="👤" label="My HR" />
          <QuickLink icon="🔔" label="Alerts" />
        </View>

        {/* Upcoming */}
        <Text style={styles.sectionTitle}>Upcoming</Text>
        <View style={styles.upcomingCard}>
          <View style={styles.upcomingRow}>
            <View style={[styles.upcomingDot, { backgroundColor: colors.primary }]} />
            <View style={styles.upcomingText}>
              <Text style={styles.upcomingTitle}>Fire Safety Training</Text>
              <Text style={styles.upcomingMeta}>Due in 2 days · LMS</Text>
            </View>
          </View>
          <View style={styles.upcomingRow}>
            <View style={[styles.upcomingDot, { backgroundColor: colors.warning }]} />
            <View style={styles.upcomingText}>
              <Text style={styles.upcomingTitle}>Shift: 9am – 5pm, Warehouse A</Text>
              <Text style={styles.upcomingMeta}>Tomorrow · Rostering</Text>
            </View>
          </View>
          <View style={styles.upcomingRow}>
            <View style={[styles.upcomingDot, { backgroundColor: colors.success }]} />
            <View style={styles.upcomingText}>
              <Text style={styles.upcomingTitle}>Manual Handling refresher</Text>
              <Text style={styles.upcomingMeta}>Due in 7 days · LMS</Text>
            </View>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.background },
  container:       { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.lg },
  greeting:        { fontSize: font.sizes.lg, fontWeight: "700", color: colors.text },
  subGreeting:     { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  avatar:          { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarLetter:    { color: colors.white, fontSize: font.sizes.md, fontWeight: "700" },
  statsRow:        { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statCard:        { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.card },
  statValue:       { fontSize: font.sizes.lg, fontWeight: "800" },
  statLabel:       { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  sectionTitle:    { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  quickRow:        { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  quickLink:       { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, alignItems: "center", gap: spacing.xs, ...shadow.card },
  quickIcon:       { fontSize: 22 },
  quickLabel:      { fontSize: font.sizes.xs, color: colors.textSecondary, fontWeight: "600", textAlign: "center" },
  upcomingCard:    { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.md, ...shadow.card, marginBottom: spacing.lg },
  upcomingRow:     { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  upcomingDot:     { width: 8, height: 8, borderRadius: radius.full, marginTop: 5 },
  upcomingText:    { flex: 1 },
  upcomingTitle:   { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text },
  upcomingMeta:    { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },
  signOutBtn:      { alignItems: "center", paddingVertical: spacing.md },
  signOutText:     { fontSize: font.sizes.sm, color: colors.textMuted },
});
