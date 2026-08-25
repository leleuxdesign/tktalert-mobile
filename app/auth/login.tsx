import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import {
  IosPage,
  IosAppIcon,
  IosFormCard,
  IosFormRow,
  IosInput,
  IosButton,
  IosErrorBanner,
} from "@/components/ios6";

export default function LoginScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data: any) => {
      if (data?.success && data?.user) {
        await AsyncStorage.setItem("auth_user", JSON.stringify(data.user));
        await utils.auth.me.invalidate();
        router.replace("/tabs/dashboard");
      }
    },
    onError: (err: any) => setError(err.message || "Invalid email or password."),
  });

  const handleLogin = () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    loginMutation.mutate({ email: email.trim().toLowerCase(), password });
  };

  return (
    <IosPage>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 40, paddingBottom: 40 }}>
          <View style={styles.header}>
            <IosAppIcon gradient={gradients.appIconBlue}>
              <Bell size={40} color="#fff" strokeWidth={2} />
            </IosAppIcon>
            <Text style={styles.title}>TattleTow</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          <IosFormCard style={{ marginBottom: 16 }}>
            <IosFormRow>
              <IosInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.bareInput}
              />
            </IosFormRow>
            <IosFormRow last>
              <IosInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.bareInput}
              />
            </IosFormRow>
          </IosFormCard>

          {error ? <IosErrorBanner>{error}</IosErrorBanner> : null}

          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <IosButton variant="blue" onPress={handleLogin} loading={loginMutation.isPending}>
              Sign In →
            </IosButton>
          </View>

          <Link href="/auth/forgot-password" asChild>
            <Text style={styles.link}>Forgot Password?</Text>
          </Link>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>NEW TO TATTLETOW?</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            <Link href="/auth/signup" asChild>
              <IosButton variant="silver">Create Account</IosButton>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 14, letterSpacing: -0.4, fontFamily },
  subtitle: { fontSize: 14, color: colors.textLight, marginTop: 4, fontFamily },
  bareInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 13,
    paddingHorizontal: 16,
    height: undefined,
  },
  link: { color: colors.blue, fontSize: 15, textAlign: "center", paddingVertical: 8, fontFamily },
  divider: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginVertical: 16, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.separator },
  dividerText: { fontSize: 12, color: colors.textLight, fontWeight: "700", letterSpacing: 0.5, fontFamily },
});
