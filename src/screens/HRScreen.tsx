import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth }      from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

const LEAVE_TYPES = ["Annual leave", "Sick leave", "Personal leave", "Unpaid leave"];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function LeaveBalance({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <View style={styles.leaveCard}>
      <View style={styles.leaveHeader}>
        <Text style={styles.leaveLabel}>{label}</Text>
        <Text style={[styles.leaveCount, { color }]}>{total - used} days left</Text>
      </View>
      <View style={styles.leaveTrack}>
        <View style={[styles.leaveFill, { width: `${100 - pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.leaveSub}>{used} of {total} days used</Text>
    </View>
  );
}

export default function HRScreen() {
  const { user } = useAuth();
  const [showRequest, setShowRequest] = useState(false);
  const [leaveType,   setLeaveType]   = useState(LEAVE_TYPES[0]);

  const name = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Employee";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerArea}>
          <Text style={styles.pageTitle}>My HR</Text>
          <Text style={styles.pageSub}>Profile, leave &amp; documents</Text>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileLetter}>{name[0]?.toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? "—"}</Text>
            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>Employee</Text>
            </View>
          </View>
        </View>

        {/* My details */}
        <Text style={styles.sectionTitle}>My details</Text>
        <View style={styles.detailsCard}>
          <InfoRow label="Employee ID"  value="EMP-00142" />
          <InfoRow label="Department"   value="Operations" />
          <InfoRow label="Start date"   value="12 Jan 2025" />
          <InfoRow label="Manager"      value="Sarah Chen" />
          <InfoRow label="Employment"   value="Full-time" />
          <InfoRow label="Location"     value="Warehouse A" />
        </View>

        {/* Leave balances */}
        <Text style={styles.sectionTitle}>Leave balances</Text>
        <View style={styles.leaveGrid}>
          <LeaveBalance label="Annual"   used={5}  total={20} color={colors.primary} />
          <LeaveBalance label="Sick"     used={2}  total={10} color={colors.warning} />
          <LeaveBalance label="Personal" used={0}  total={3}  color={colors.success} />
        </View>

        {/* Request leave button */}
        <TouchableOpacity
          style={styles.requestBtn}
          onPress={() => setShowRequest(v => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.requestBtnText}>
            {showRequest ? "Cancel request" : "➕  Request leave"}
          </Text>
        </TouchableOpacity>

        {showRequest && (
          <View style={styles.requestForm}>
            <Text style={styles.formTitle}>Leave request</Text>
            <Text style={styles.formLabel}>Leave type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {LEAVE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setLeaveType(t)}
                  style={[styles.typeChip, leaveType === t && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, leaveType === t && styles.typeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.comingSoon}>📅 Date picker coming soon — your manager will be notified.</Text>
            <TouchableOpacity style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Submit request</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Documents */}
        <Text style={styles.sectionTitle}>My documents</Text>
        <View style={styles.docsCard}>
          {[
            { icon: "📄", label: "Employment contract",   date: "12 Jan 2025" },
            { icon: "📋", label: "Induction checklist",   date: "15 Jan 2025" },
            { icon: "🔒", label: "Privacy policy signed", date: "12 Jan 2025" },
          ].map(doc => (
            <TouchableOpacity key={doc.label} style={styles.docRow} activeOpacity={0.7}>
              <Text style={styles.docIcon}>{doc.icon}</Text>
              <View style={styles.docInfo}>
                <Text style={styles.docLabel}>{doc.label}</Text>
                <Text style={styles.docDate}>{doc.date}</Text>
              </View>
              <Text style={styles.docArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.background },
  container:          { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  headerArea:         { paddingTop: spacing.md, paddingBottom: spacing.md },
  pageTitle:          { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:            { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  profileCard:        { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, ...shadow.card },
  profileAvatar:      { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  profileLetter:      { fontSize: font.sizes.xl, fontWeight: "800", color: colors.white },
  profileInfo:        { flex: 1 },
  profileName:        { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  profileEmail:       { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },
  profileBadge:       { alignSelf: "flex-start", marginTop: spacing.xs, backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  profileBadgeText:   { fontSize: font.sizes.xs, fontWeight: "700", color: colors.primary },
  sectionTitle:       { fontSize: font.sizes.base, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  detailsCard:        { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.lg, ...shadow.card },
  infoRow:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel:          { fontSize: font.sizes.sm, color: colors.textSecondary },
  infoValue:          { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text },
  leaveGrid:          { gap: spacing.sm, marginBottom: spacing.lg },
  leaveCard:          { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.card },
  leaveHeader:        { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  leaveLabel:         { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  leaveCount:         { fontSize: font.sizes.sm, fontWeight: "700" },
  leaveTrack:         { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: "hidden", marginBottom: 4 },
  leaveFill:          { height: "100%", borderRadius: radius.full },
  leaveSub:           { fontSize: font.sizes.xs, color: colors.textMuted },
  requestBtn:         { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginBottom: spacing.md },
  requestBtnText:     { fontSize: font.sizes.base, fontWeight: "700", color: colors.primary },
  requestForm:        { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, ...shadow.card },
  formTitle:          { fontSize: font.sizes.md, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  formLabel:          { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  typeChip:           { marginRight: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  typeChipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText:       { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: "600" },
  typeChipTextActive: { color: colors.white },
  comingSoon:         { fontSize: font.sizes.sm, color: colors.textSecondary, marginBottom: spacing.md },
  submitBtn:          { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 12, alignItems: "center" },
  submitBtnText:      { fontSize: font.sizes.sm, fontWeight: "700", color: colors.white },
  docsCard:           { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.md, ...shadow.card, marginBottom: spacing.xxl },
  docRow:             { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  docIcon:            { fontSize: 22, width: 30 },
  docInfo:            { flex: 1 },
  docLabel:           { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text },
  docDate:            { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },
  docArrow:           { fontSize: 22, color: colors.textMuted },
});
