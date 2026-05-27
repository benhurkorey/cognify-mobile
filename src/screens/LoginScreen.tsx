import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  TextInput as RNTextInput,
} from "react-native";
import { StatusBar }  from "expo-status-bar";
import { Ionicons }   from "@expo/vector-icons";
import { useAuth }    from "../auth/AuthContext";
import { colors, spacing, radius, font, shadow } from "../lib/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [pwVisible, setPwVisible] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused,    setPwFocused]    = useState(false);
  const pwRef = useRef<RNTextInput>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.error) setError(result.error);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />

      {/* Indigo background panel */}
      <View style={styles.topPanel} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brandArea}>
          <View style={styles.logoBox}>
            <Ionicons name="layers" size={26} color={colors.primary} />
          </View>
          <Text style={styles.brandName}>Cognify</Text>
          <Text style={styles.tagline}>Your work. Your training. All in one place.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in with your company account</Text>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} style={{ marginTop: 1 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <Text style={styles.label}>Email address</Text>
          <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
            <Ionicons name="mail-outline" size={17} color={emailFocused ? colors.primary : colors.textMuted} style={styles.inputIcon} />
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
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              onSubmitEditing={() => pwRef.current?.focus()}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputWrap, pwFocused && styles.inputWrapFocused]}>
            <Ionicons name="lock-closed-outline" size={17} color={pwFocused ? colors.primary : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={pwRef}
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!pwVisible}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
            />
            <TouchableOpacity onPress={() => setPwVisible(v => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={pwVisible ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>Sign in</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </View>
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

  // Solid color top panel (simulates gradient header)
  topPanel:        { position: "absolute", top: 0, left: 0, right: 0, height: "55%", backgroundColor: colors.primary },

  container:       {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    backgroundColor: "transparent",
  },

  // Brand
  brandArea:       { alignItems: "center", marginBottom: spacing.xl },
  logoBox:         {
    width: 60, height: 60, borderRadius: radius.xl,
    backgroundColor: colors.white,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.sm,
    ...shadow.md,
  },
  brandName:       { fontSize: font.sizes.xxl, fontWeight: "800", color: colors.white, letterSpacing: -0.5, marginBottom: spacing.xs },
  tagline:         { fontSize: font.sizes.sm, color: "rgba(255,255,255,0.72)", textAlign: "center", lineHeight: 18 },

  // Card
  card:            {
    width: "100%", maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    ...shadow.md,
  },
  cardTitle:       { fontSize: font.sizes.lg, fontWeight: "800", color: colors.text, marginBottom: 4 },
  cardSub:         { fontSize: font.sizes.sm, color: colors.textSecondary, marginBottom: spacing.lg },

  // Error
  errorBox:        {
    flexDirection: "row", gap: spacing.xs, alignItems: "flex-start",
    backgroundColor: colors.dangerLight, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.md,
    borderWidth: 1, borderColor: "#FECACA",
  },
  errorText:       { flex: 1, color: colors.danger, fontSize: font.sizes.sm, lineHeight: 18 },

  // Inputs
  label:           { fontSize: font.sizes.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
  inputWrap:       {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  inputWrapFocused: { borderColor: colors.primary, backgroundColor: colors.white },
  inputIcon:       { marginRight: 6 },
  input:           {
    flex: 1,
    paddingVertical: 13,
    fontSize: font.sizes.base,
    color: colors.text,
  },
  eyeBtn:          { padding: 4 },

  // Button
  button:          {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    ...shadow.button,
  },
  buttonDisabled:  { opacity: 0.6 },
  buttonInner:     { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  buttonText:      { color: colors.white, fontSize: font.sizes.base, fontWeight: "700" },

  // Help / footer
  helpText:        { fontSize: font.sizes.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm, lineHeight: 17 },
  footer:          { marginTop: spacing.lg, fontSize: font.sizes.xs, color: "rgba(255,255,255,0.35)" },
});
