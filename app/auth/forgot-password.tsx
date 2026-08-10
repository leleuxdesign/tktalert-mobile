import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import {
  IosPage,
  IosNavBar,
  IosAppIcon,
  IosFormCard,
  IosInput,
  IosButton,
  IosErrorBanner,
} from "@/components/ios6";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    // TODO: wire to auth.requestPasswordReset once the backend implements it
    setSubmitted(true);
  };

  return (
    <IosPage>
      <IosNavBar title="Reset Password" onBack={() => router.back()} backLabel="Sign In" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 40 }}>
          <View style={styles.header}>
            <IosAppIcon size={64} gradient={gradients.appIconBlue}>
              <Mail size={30} color="#fff" strokeWidth={2} />
            </IosAppIcon>
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.subtitle}>
              {submitted
                ? "Check your email for a password reset link."
                : "Enter your email address and we'll send you a reset link."}
            </Text>
          </View>

          {submitted ? (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✓ Reset link sent to {email}</Text>
              </View>
              <IosButton variant="silver" onPress={() => router.back()}>
                ← Back to Sign In
              </IosButton>
            </View>
          ) : (
            <>
              <IosFormCard style={{ marginBottom: 16 }}>
                <IosInput
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={styles.bareInput}
                />
              </IosFormCard>

              {error ? <IosErrorBanner>{error}</IosErrorBanner> : null}

              <View style={{ paddingHorizontal: 16, gap: 12 }}>
                <IosButton variant="blue" onPress={handleSubmit}>
                  Send Reset Link →
                </IosButton>
                <IosButton variant="silver" onPress={() => router.back()}>
                  ← Back to Sign In
                </IosButton>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 28, paddingHorizontal: 20 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 14, marginBottom: 6, fontFamily },
  subtitle: { fontSize: 14, color: colors.textLight, lineHeight: 20, textAlign: "center", fontFamily },
  bareInput: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, paddingVertical: 13, paddingHorizontal: 16, height: undefined },
  successBanner: { padding: 16, backgroundColor: "#f0fff4", borderWidth: 1, borderColor: "#86efac", borderRadius: 10, marginBottom: 16 },
  successText: { fontSize: 14, color: "#166534", textAlign: "center", fontFamily },
});
