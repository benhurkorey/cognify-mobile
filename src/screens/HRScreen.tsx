import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons }     from "@expo/vector-icons";
import { useAuth }      from "../auth/AuthContext";
import { supabase }     from "../lib/supabase";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  full_name:  string | null;
  email:      string;
  phone:      string | null;
  timezone:   string | null;
  created_at: string;
}

interface Membership {
  company_id: string;
  role:       string;
  status:     string;
  joined_at:  string | null;
}

interface EmployeeRecord {
  job_title:        string | null;
  department:       string | null;
  employment_type:  string | null;
  start_date:       string | null;
}

interface LeaveRequest {
  id:         string;
  leave_type: string;
  start_date: string;
  end_date:   string;
  days:       number;
  reason:     string | null;
  status:     string;
  created_at: string;
}

interface Certificate {
  id:                 string;
  certificate_number: string;
  issued_at:          string;
  expires_at:         string | null;
  revoked_at:         string | null;
  lms_courses:        { title: string } | null;
}

interface PolicyAssignment {
  id:        string;
  policy_id: string;
  due_date:  string | null;
  hr_policies: {
    id:                      string;
    title:                   string;
    category:                string;
    version:                 string;
    requires_acknowledgement: boolean;
    effective_date:          string | null;
    deleted_at:              string | null;
    archived_at:             string | null;
  } | null;
}

interface PolicyAck {
  policy_id:      string;
  policy_version: string;
  acknowledged_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual:   "Annual leave",
  sick:     "Sick leave",
  personal: "Personal leave",
  unpaid:   "Unpaid leave",
  other:    "Other",
};

const LEAVE_STATUS_META: Record<string, { color: string; label: string }> = {
  pending:  { color: colors.warning, label: "Pending"  },
  approved: { color: colors.success, label: "Approved" },
  declined: { color: colors.danger,  label: "Declined" },
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time:  "Full-time",
  part_time:  "Part-time",
  contractor: "Contractor",
  casual:     "Casual",
  intern:     "Intern",
};

const CERT_CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  general:         "document-text-outline",
  safety:          "shield-checkmark-outline",
  hr:              "people-outline",
  it:              "laptop-outline",
  finance:         "cash-outline",
  code_of_conduct: "hand-right-outline",
  other:           "document-outline",
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function certStatus(cert: Certificate): { label: string; color: string } {
  if (cert.revoked_at) return { label: "Revoked", color: colors.danger };
  if (cert.expires_at && new Date(cert.expires_at) < new Date()) return { label: "Expired", color: colors.warning };
  return { label: "Active", color: colors.success };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, icon }: { label: string; value: string; icon: IoniconName }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={14} color={colors.textSecondary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HRScreen() {
  const { user } = useAuth();

  // Core data
  const [profile,    setProfile]    = useState<UserProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [employee,   setEmployee]   = useState<EmployeeRecord | null>(null);
  const [leaveReqs,  setLeaveReqs]  = useState<LeaveRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Leave form
  const [showRequest,   setShowRequest]   = useState(false);
  const [leaveType,     setLeaveType]     = useState<string>("annual");
  const [leaveReason,   setLeaveReason]   = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Certificates
  const [certificates,   setCertificates]   = useState<Certificate[]>([]);
  const [certsLoading,   setCertsLoading]   = useState(true);

  // Policies
  const [policyAssignments, setPolicyAssignments] = useState<PolicyAssignment[]>([]);
  const [policyAcks,        setPolicyAcks]        = useState<PolicyAck[]>([]);
  const [policiesLoading,   setPoliciesLoading]   = useState(true);
  const [acknowledging,     setAcknowledging]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [userRes, memRes, empRes, leaveRes] = await Promise.all([
        supabase.from("lms_users").select("full_name, email, phone, timezone, created_at").eq("id", user.id).maybeSingle(),
        supabase.from("memberships").select("company_id, role, status, joined_at").eq("user_id", user.id).eq("status", "active").is("deleted_at", null).order("joined_at", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("hr_employees").select("job_title, department, employment_type, start_date").eq("user_id", user.id).is("deleted_at", null).maybeSingle(),
        supabase.from("hr_leave_requests").select("id, leave_type, start_date, end_date, days, reason, status, created_at").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
      ]);

      if (userRes.error)  throw userRes.error;
      if (memRes.error)   throw memRes.error;
      if (leaveRes.error) throw leaveRes.error;

      setProfile(userRes.data as UserProfile | null);
      setMembership(memRes.data as Membership | null);
      setEmployee(empRes.data as EmployeeRecord | null);
      setLeaveReqs((leaveRes.data ?? []) as LeaveRequest[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load HR data.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadCertificates = useCallback(async () => {
    if (!user?.id) return;
    setCertsLoading(true);
    try {
      const { data } = await supabase
        .from("lms_certificates")
        .select("id, certificate_number, issued_at, expires_at, revoked_at, lms_courses(title)")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("issued_at", { ascending: false });
      setCertificates((data ?? []) as unknown as Certificate[]);
    } finally {
      setCertsLoading(false);
    }
  }, [user?.id]);

  const loadPolicies = useCallback(async () => {
    if (!user?.id) return;
    setPoliciesLoading(true);
    try {
      const [assignRes, ackRes] = await Promise.all([
        supabase
          .from("hr_policy_assignments")
          .select("id, policy_id, due_date, hr_policies(id, title, category, version, requires_acknowledgement, effective_date, deleted_at, archived_at)")
          .eq("user_id", user.id),
        supabase
          .from("hr_policy_acknowledgements")
          .select("policy_id, policy_version, acknowledged_at")
          .eq("user_id", user.id),
      ]);
      // Filter out deleted/archived policies
      const assignments = ((assignRes.data ?? []) as unknown as PolicyAssignment[]).filter(
        a => a.hr_policies && !a.hr_policies.deleted_at && !a.hr_policies.archived_at
      );
      setPolicyAssignments(assignments as unknown as PolicyAssignment[]);
      setPolicyAcks((ackRes.data ?? []) as PolicyAck[]);
    } finally {
      setPoliciesLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); },             [load]);
  useEffect(() => { loadCertificates(); }, [loadCertificates]);
  useEffect(() => { loadPolicies(); },     [loadPolicies]);

  // ── Submit leave request ───────────────────────────────────────
  async function submitLeaveRequest() {
    if (!user?.id || !membership?.company_id) {
      Alert.alert("Error", "Could not determine your company. Please try again.");
      return;
    }
    if (!leaveReason.trim()) {
      Alert.alert("Required", "Please enter a reason for your leave request.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase
        .from("hr_leave_requests")
        .insert({
          user_id:    user.id,
          company_id: membership.company_id,
          leave_type: leaveType,
          reason:     leaveReason.trim(),
          start_date: new Date().toISOString().slice(0, 10),
          end_date:   new Date().toISOString().slice(0, 10),
          days:       1,
          status:     "pending",
        });
      if (insertErr) throw insertErr;
      setSubmitSuccess(true);
      setLeaveReason("");
      setShowRequest(false);
      const { data } = await supabase
        .from("hr_leave_requests")
        .select("id, leave_type, start_date, end_date, days, reason, status, created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setLeaveReqs((data ?? []) as LeaveRequest[]);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Acknowledge policy ─────────────────────────────────────────
  async function acknowledgePolicy(assignment: PolicyAssignment) {
    if (!user?.id || !membership?.company_id || !assignment.hr_policies) return;
    const policy = assignment.hr_policies;
    setAcknowledging(assignment.id);
    try {
      const { error: insertErr } = await supabase
        .from("hr_policy_acknowledgements")
        .insert({
          policy_id:      policy.id,
          company_id:     membership.company_id,
          user_id:        user.id,
          policy_version: policy.version,
        });
      // Ignore unique violation (already acknowledged)
      if (insertErr && insertErr.code !== "23505") throw insertErr;
      // Refresh acks
      const { data } = await supabase
        .from("hr_policy_acknowledgements")
        .select("policy_id, policy_version, acknowledged_at")
        .eq("user_id", user.id);
      setPolicyAcks((data ?? []) as PolicyAck[]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not acknowledge policy.");
    } finally {
      setAcknowledging(null);
    }
  }

  // ── Derived values ─────────────────────────────────────────────

  const displayName  = profile?.full_name ?? user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Employee";
  const displayEmail = profile?.email ?? user?.email ?? "—";
  const initials     = displayName.trim().split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel    = membership?.role === "admin" ? "Admin" : membership?.role === "trainer" ? "Trainer" : "Employee";
  const memberSince  = membership?.joined_at ?? profile?.created_at;

  const ackSet = new Set(policyAcks.map(a => `${a.policy_id}:${a.policy_version}`));
  const pendingPolicies = policyAssignments.filter(
    a => a.hr_policies?.requires_acknowledgement && !ackSet.has(`${a.hr_policies.id}:${a.hr_policies.version}`)
  );

  // ── Loading state ──────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your HR data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load HR data</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.headerArea}>
          <Text style={styles.pageTitle}>My HR</Text>
          <Text style={styles.pageSub}>Profile, leave &amp; documents</Text>
        </View>

        {/* ── Submit success banner ────────────────────────────────── */}
        {submitSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.successBannerText}>Leave request submitted — your manager will be notified.</Text>
          </View>
        )}

        {/* ── Pending policy alert ─────────────────────────────────── */}
        {pendingPolicies.length > 0 && (
          <View style={styles.policyAlert}>
            <Ionicons name="document-text-outline" size={16} color={colors.warning} />
            <Text style={styles.policyAlertText}>
              {pendingPolicies.length} polic{pendingPolicies.length !== 1 ? "ies require" : "y requires"} your acknowledgement
            </Text>
          </View>
        )}

        {/* ── Profile card ─────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitials}>{initials}</Text>
            </View>
            <View style={styles.profileBadge}>
              <Ionicons name="shield-checkmark-outline" size={11} color={colors.white} />
              <Text style={styles.profileBadgeText}>{roleLabel}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{displayEmail}</Text>
          {memberSince && (
            <Text style={styles.profileSince}>Member since {formatDate(memberSince)}</Text>
          )}
        </View>

        {/* ── My details ───────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>My details</Text>
        <View style={styles.detailsCard}>
          <InfoRow label="Full name"    value={displayName}  icon="person-outline"            />
          <InfoRow label="Email"        value={displayEmail} icon="mail-outline"              />
          <InfoRow label="Role"         value={roleLabel}    icon="shield-checkmark-outline"  />
          {profile?.phone && (
            <InfoRow label="Phone"     value={profile.phone}                                   icon="call-outline"    />
          )}
          {profile?.timezone && profile.timezone !== "UTC" && (
            <InfoRow label="Timezone"  value={profile.timezone}                                icon="globe-outline"   />
          )}
          {memberSince && (
            <InfoRow label="Member since" value={formatDate(memberSince)}                      icon="calendar-outline" />
          )}
        </View>

        {/* ── Employment ───────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Employment</Text>
        {employee ? (
          <View style={styles.detailsCard}>
            {employee.job_title && (
              <InfoRow label="Job title"       value={employee.job_title}  icon="briefcase-outline" />
            )}
            {employee.department && (
              <InfoRow label="Department"      value={employee.department} icon="business-outline"  />
            )}
            {employee.employment_type && (
              <InfoRow label="Employment type" value={EMPLOYMENT_TYPE_LABELS[employee.employment_type] ?? employee.employment_type} icon="layers-outline" />
            )}
            {employee.start_date && (
              <InfoRow label="Start date"      value={formatDate(employee.start_date)} icon="calendar-outline" />
            )}
            {!employee.job_title && !employee.department && !employee.employment_type && !employee.start_date && (
              <View style={styles.emptyInCard}>
                <Text style={styles.emptyInCardText}>Employment details not yet filled in by your admin.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="briefcase-outline" size={24} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyCardTitle}>No employment record</Text>
              <Text style={styles.emptyCardBody}>Your admin hasn't added your employment details yet.</Text>
            </View>
          </View>
        )}

        {/* ── Leave ────────────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Leave</Text>
          {leaveReqs.length > 0 && (
            <Text style={styles.sectionCount}>{leaveReqs.length} request{leaveReqs.length !== 1 ? "s" : ""}</Text>
          )}
        </View>

        {leaveReqs.length > 0 && (
          <View style={styles.leaveList}>
            {leaveReqs.map((req, idx) => {
              const meta   = LEAVE_STATUS_META[req.status] ?? LEAVE_STATUS_META.pending;
              const isLast = idx === leaveReqs.length - 1;
              return (
                <View key={req.id} style={[styles.leaveRow, !isLast && styles.leaveRowBorder]}>
                  <View style={styles.leaveRowLeft}>
                    <Text style={styles.leaveType}>{LEAVE_TYPE_LABELS[req.leave_type] ?? req.leave_type}</Text>
                    <Text style={styles.leaveDates}>
                      {formatDate(req.start_date)}
                      {req.start_date !== req.end_date ? ` – ${formatDate(req.end_date)}` : ""}
                      {" · "}{req.days} day{req.days !== 1 ? "s" : ""}
                    </Text>
                    {req.reason && <Text style={styles.leaveReason} numberOfLines={1}>{req.reason}</Text>}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.color + "18" }]}>
                    <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                    <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.requestBtn, showRequest && styles.requestBtnCancel]}
          onPress={() => { setShowRequest(v => !v); setLeaveReason(""); setLeaveType("annual"); }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={showRequest ? "close-circle-outline" : "add-circle-outline"}
            size={18}
            color={showRequest ? colors.danger : colors.primary}
          />
          <Text style={[styles.requestBtnText, showRequest && styles.requestBtnTextCancel]}>
            {showRequest ? "Cancel" : "Request leave"}
          </Text>
        </TouchableOpacity>

        {showRequest && (
          <View style={styles.requestForm}>
            <Text style={styles.formTitle}>New leave request</Text>
            <Text style={styles.formLabel}>Leave type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {(["annual", "sick", "personal", "unpaid"] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setLeaveType(t)}
                  style={[styles.typeChip, leaveType === t && styles.typeChipActive]}
                >
                  <Text style={[styles.typeChipText, leaveType === t && styles.typeChipTextActive]}>
                    {LEAVE_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.formLabel}>Reason</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Brief reason for your request…"
              placeholderTextColor={colors.textMuted}
              value={leaveReason}
              onChangeText={setLeaveReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.formNote}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.formNoteText}>Exact dates can be set by your manager when they review the request.</Text>
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={submitLeaveRequest}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={15} color={colors.white} />
                  <Text style={styles.submitBtnText}>Submit request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {leaveReqs.length === 0 && !showRequest && (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyCardTitle}>No leave requests yet</Text>
              <Text style={styles.emptyCardBody}>Tap "Request leave" above to submit one.</Text>
            </View>
          </View>
        )}

        {/* ── Certificates ─────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>My Certificates</Text>
          {certificates.length > 0 && (
            <Text style={styles.sectionCount}>{certificates.length} issued</Text>
          )}
        </View>

        {certsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingRowText}>Loading certificates…</Text>
          </View>
        ) : certificates.length > 0 ? (
          <View style={styles.certList}>
            {certificates.map((cert, idx) => {
              const status  = certStatus(cert);
              const isLast  = idx === certificates.length - 1;
              const title   = (cert.lms_courses as any)?.title ?? "Certificate";
              return (
                <View key={cert.id} style={[styles.certRow, !isLast && styles.certRowBorder]}>
                  <View style={[styles.certIconWrap, { backgroundColor: status.color + "14" }]}>
                    <Ionicons name="ribbon-outline" size={18} color={status.color} />
                  </View>
                  <View style={styles.certContent}>
                    <Text style={styles.certTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.certMeta}>
                      Issued {formatDate(cert.issued_at)}
                      {cert.expires_at ? ` · Expires ${formatDate(cert.expires_at)}` : ""}
                    </Text>
                    <Text style={styles.certNumber} numberOfLines={1}>{cert.certificate_number}</Text>
                  </View>
                  <View style={[styles.certBadge, { backgroundColor: status.color + "18" }]}>
                    <Text style={[styles.certBadgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="ribbon-outline" size={24} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyCardTitle}>No certificates yet</Text>
              <Text style={styles.emptyCardBody}>Complete training courses to earn certificates.</Text>
            </View>
          </View>
        )}

        {/* ── Policies ─────────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Workplace Policies</Text>
          {pendingPolicies.length > 0 && (
            <Text style={[styles.sectionCount, { color: colors.warning }]}>
              {pendingPolicies.length} pending
            </Text>
          )}
        </View>

        {policiesLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingRowText}>Loading policies…</Text>
          </View>
        ) : policyAssignments.length > 0 ? (
          <View style={styles.policyList}>
            {policyAssignments.map((assignment, idx) => {
              const policy     = assignment.hr_policies!;
              const isAcked    = ackSet.has(`${policy.id}:${policy.version}`);
              const isLast     = idx === policyAssignments.length - 1;
              const catIcon    = CERT_CATEGORY_ICONS[policy.category] ?? "document-outline";
              const isLoading  = acknowledging === assignment.id;
              return (
                <View key={assignment.id} style={[styles.policyRow, !isLast && styles.policyRowBorder]}>
                  <View style={[styles.policyIconWrap, { backgroundColor: isAcked ? colors.successLight : colors.warningLight }]}>
                    <Ionicons name={catIcon} size={16} color={isAcked ? colors.success : colors.warning} />
                  </View>
                  <View style={styles.policyContent}>
                    <Text style={styles.policyTitle} numberOfLines={1}>{policy.title}</Text>
                    <Text style={styles.policyMeta}>
                      v{policy.version}
                      {policy.effective_date ? ` · Effective ${formatDate(policy.effective_date)}` : ""}
                      {assignment.due_date ? ` · Due ${formatDate(assignment.due_date)}` : ""}
                    </Text>
                    {isAcked ? (
                      <View style={styles.ackedRow}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                        <Text style={styles.ackedText}>Acknowledged</Text>
                      </View>
                    ) : policy.requires_acknowledgement ? (
                      <TouchableOpacity
                        style={[styles.ackBtn, isLoading && { opacity: 0.6 }]}
                        onPress={() => acknowledgePolicy(assignment)}
                        activeOpacity={0.82}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <>
                            <Ionicons name="checkmark-outline" size={12} color={colors.white} />
                            <Text style={styles.ackBtnText}>I acknowledge this policy</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, { marginBottom: spacing.xxl }]}>
            <Ionicons name="document-text-outline" size={24} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyCardTitle}>No policies assigned</Text>
              <Text style={styles.emptyCardBody}>Your HR admin will assign workplace policies here.</Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },

  // Center loading / error
  center:        { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText:   { marginTop: spacing.sm, fontSize: font.sizes.sm, color: colors.textSecondary },
  errorIconWrap: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  errorTitle:    { fontSize: font.sizes.md, fontWeight: "700", color: colors.text },
  errorBody:     { fontSize: font.sizes.sm, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
  retryBtn:      { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md },
  retryText:     { fontSize: font.sizes.sm, fontWeight: "700", color: colors.primary },

  // Header
  headerArea: { paddingTop: spacing.md, paddingBottom: spacing.md },
  pageTitle:  { fontSize: font.sizes.xl, fontWeight: "800", color: colors.text },
  pageSub:    { fontSize: font.sizes.sm, color: colors.textSecondary, marginTop: 2 },

  // Banners
  successBanner:     { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.success + "30" },
  successBannerText: { flex: 1, fontSize: font.sizes.sm, color: colors.success, fontWeight: "600", lineHeight: 18 },
  policyAlert:       { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.warning + "40" },
  policyAlertText:   { flex: 1, fontSize: font.sizes.sm, color: colors.warning, fontWeight: "600" },

  // Profile card
  profileCard:      { backgroundColor: colors.primary, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.button },
  profileTop:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  profileAvatar:    { width: 56, height: 56, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
  profileInitials:  { fontSize: font.sizes.lg, fontWeight: "800", color: colors.white },
  profileBadge:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  profileBadgeText: { fontSize: font.sizes.xs, fontWeight: "700", color: colors.white },
  profileName:      { fontSize: font.sizes.lg, fontWeight: "800", color: colors.white, marginBottom: 2 },
  profileEmail:     { fontSize: font.sizes.sm, color: "rgba(255,255,255,0.72)" },
  profileSince:     { fontSize: font.sizes.xs, color: "rgba(255,255,255,0.50)", marginTop: 4 },

  // Section titles
  sectionTitle: { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  sectionRow:   { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionCount: { fontSize: font.sizes.xs, color: colors.textMuted, marginBottom: spacing.sm },

  // Details card
  detailsCard:  { backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: spacing.md, marginBottom: spacing.lg, ...shadow.card },
  infoRow:      { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoIconWrap: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  infoContent:  { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel:    { fontSize: font.sizes.sm, color: colors.textSecondary },
  infoValue:    { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text, maxWidth: "55%", textAlign: "right" },

  // Empty in card
  emptyInCard:     { paddingVertical: spacing.md },
  emptyInCardText: { fontSize: font.sizes.sm, color: colors.textMuted, textAlign: "center" },

  // Empty card
  emptyCard:      { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, ...shadow.card, borderWidth: 1, borderColor: colors.borderLight },
  emptyCardTitle: { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text, marginBottom: 2 },
  emptyCardBody:  { fontSize: font.sizes.xs, color: colors.textMuted, lineHeight: 17 },

  // Loading row
  loadingRow:     { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, marginBottom: spacing.md, ...shadow.card },
  loadingRowText: { fontSize: font.sizes.sm, color: colors.textSecondary },

  // Leave list
  leaveList:      { backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: spacing.md, ...shadow.card, marginBottom: spacing.sm },
  leaveRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 13 },
  leaveRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  leaveRowLeft:   { flex: 1, paddingRight: spacing.sm },
  leaveType:      { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  leaveDates:     { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  leaveReason:    { fontSize: font.sizes.xs, color: colors.textMuted, marginTop: 2 },
  statusBadge:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, flexShrink: 0 },
  statusDot:      { width: 5, height: 5, borderRadius: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },

  // Request button + form
  requestBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.lg, paddingVertical: 14, marginBottom: spacing.sm },
  requestBtnCancel:     { backgroundColor: colors.dangerLight },
  requestBtnText:       { fontSize: font.sizes.base, fontWeight: "700", color: colors.primary },
  requestBtnTextCancel: { color: colors.danger },
  requestForm:    { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.lg, ...shadow.card },
  formTitle:      { fontSize: font.sizes.md, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  formLabel:      { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  typeChip:       { marginRight: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText:   { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: "600" },
  typeChipTextActive: { color: colors.white },
  reasonInput:    { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: font.sizes.base, color: colors.text, backgroundColor: colors.surface, marginBottom: spacing.sm, minHeight: 80 },
  formNote:       { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  formNoteText:   { flex: 1, fontSize: font.sizes.xs, color: colors.textSecondary, lineHeight: 17 },
  submitBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, ...shadow.button },
  submitBtnText:  { fontSize: font.sizes.sm, fontWeight: "700", color: colors.white },

  // Certificates
  certList:      { backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: spacing.md, marginBottom: spacing.lg, ...shadow.card },
  certRow:       { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 14 },
  certRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  certIconWrap:  { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  certContent:   { flex: 1 },
  certTitle:     { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text },
  certMeta:      { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2 },
  certNumber:    { fontSize: 10, color: colors.textMuted, marginTop: 2, fontFamily: "monospace" },
  certBadge:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, flexShrink: 0 },
  certBadgeText: { fontSize: 10, fontWeight: "700" },

  // Policies
  policyList:      { backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: spacing.md, marginBottom: spacing.lg, ...shadow.card },
  policyRow:       { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 14 },
  policyRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  policyIconWrap:  { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  policyContent:   { flex: 1 },
  policyTitle:     { fontSize: font.sizes.sm, fontWeight: "700", color: colors.text, marginBottom: 2 },
  policyMeta:      { fontSize: font.sizes.xs, color: colors.textSecondary, marginBottom: spacing.xs },
  ackedRow:        { flexDirection: "row", alignItems: "center", gap: 4 },
  ackedText:       { fontSize: font.sizes.xs, fontWeight: "600", color: colors.success },
  ackBtn:          { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 7, alignSelf: "flex-start" },
  ackBtnText:      { fontSize: font.sizes.xs, fontWeight: "700", color: colors.white },
});
