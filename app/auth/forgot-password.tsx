import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => setSent(true),
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Could not send reset email.");
    },
  });

  if (sent) {
    return (
      <View className="flex-1 bg-background px-6 pt-20">
        <View className="items-center">
          <Text style={{ fontSize: 48 }}>📬</Text>
          <Text className="text-foreground text-2xl font-bold mt-4 text-center">
            Check your email
          </Text>
          <Text className="text-muted text-sm mt-3 text-center leading-6">
            We sent a password reset link to {email}. Check your inbox and
            follow the link to reset your password.
          </Text>
          <Pressable
            onPress={() => router.replace("/auth/login")}
            className="mt-8 bg-surface border border-border rounded-xl py-4 px-8"
          >
            <Text className="text-foreground font-semibold">Back to Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 pt-16">
        <Pressable onPress={() => router.back()} className="mb-8">
          <Text className="text-primary text-base">← Back</Text>
        </Pressable>

        <Text className="text-foreground text-3xl font-bold mb-2">
          Reset password
        </Text>
        <Text className="text-muted text-sm mb-8 leading-6">
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <View className="gap-4">
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-base"
            placeholder="you@example.com"
            placeholderTextColor="#8a9bb0"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={() =>
              email.trim() && forgotMutation.mutate({ email: email.trim() })
            }
          />

          <Pressable
            onPress={() =>
              email.trim() && forgotMutation.mutate({ email: email.trim() })
            }
            disabled={forgotMutation.isPending || !email.trim()}
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.97 : 1 }],
              opacity:
                forgotMutation.isPending || !email.trim() ? 0.5 : 1,
            })}
            className="bg-primary rounded-xl py-4 items-center"
          >
            {forgotMutation.isPending ? (
              <ActivityIndicator color="#0d1b2a" />
            ) : (
              <Text className="text-background font-bold text-base">
                Send Reset Link
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
