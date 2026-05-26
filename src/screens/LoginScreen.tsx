import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert,
} from "react-native";
import { StatusBar }  from "expo-status-bar";
import { useAuth }    from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Brand */}
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoLetter}>C</Text>
          </View>
          <Text style={styles.brandName}>Cognify</Text>
        </View>
        <Text style={styles.tagline}>Your work. Your training. All in one place.</Text>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <Text style={styles.cardSub}>Use your company account</Text>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@company.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            autoComplete="email"
          />

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          {/* Help */}
          <Text style={styles.helpText}>
            Forgot your password? Contact your manager or HR admin.
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>Powered by Cognify · vi2ionai.com</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:            { flex: 1, backgroundColor: colors.primary },
  container:       { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  brandRow:        { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  logoBox:         { width: 48, height: 48, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoLetter:      { fontSize: font.sizes.xl, fontWeight: "800", color: colors.white },
  brandName:       { fontSize: font.sizes.xl, fontWeight: "800", color: colors.white, letterSpacing: -0.5 },
  tagline:         { fontSize: font.sizes.sm, color: "rgba(255,255,255,0.75)", marginBottom: spacing.xl, textAlign: "center" },
  card:            { width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.card },
  cardTitle:       { fontSize: font.sizes.lg, fontWeight: "700", color: colors.text, marginBottom: 4 },
  cardSub:         { fontSize: font.sizes.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  errorBox:        { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md },
  errorText:       { color: colors.danger, fontSize: font.sizes.sm },
  label:           { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  input:           { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: font.sizes.base, color: colors.text, backgroundColor: "#FAFAFA", marginBottom: spacing.md },
  button:          { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 14, alignItems: "center", marginTop: spacing.xs, ...shadow.button },
  buttonDisabled:  { opacity: 0.6 },
  buttonText:      { color: colors.white, fontSize: font.sizes.base, fontWeight: "700" },
  helpText:        { fontSize: font.sizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.md, lineHeight: 16 },
  footer:          { marginTop: spacing.xl, fontSize: font.sizes.xs, color: "rgba(255,255,255,0.4)" },
});
