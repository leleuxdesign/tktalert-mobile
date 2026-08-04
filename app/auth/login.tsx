import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Link, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data: any) => {
      if (data?.token && data?.user) {
        await Promise.all([
          AsyncStorage.setItem("auth_token", data.token),
          AsyncStorage.setItem("auth_user", JSON.stringify(data.user)),
        ]);
        router.replace("/tabs/dashboard");
      }
    },
    onError: (err: any) => {
      Alert.alert("Sign In Failed", err.message || "Invalid email or password.");
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }
    loginMutation.mutate({ email: email.trim().toLowerCase(), password });
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-20 pb-10">
          {/* Logo / Header */}
          <View className="items-center mb-12">
            <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
              <Text style={{ fontSize: 32 }}>🔔</Text>
            </View>
            <Text className="text-foreground text-3xl font-bold tracking-tight">
              TKTAlert
            </Text>
            <Text className="text-muted text-sm mt-1">
              Parking Ticket Alerts — Milwaukee
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text className="text-muted text-xs uppercase tracking-widest mb-2">
                Email
              </Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-base"
                placeholder="you@example.com"
                placeholderTextColor="#8a9bb0"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="text-muted text-xs uppercase tracking-widest mb-2">
                Password
              </Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-base"
                placeholder="••••••••"
                placeholderTextColor="#8a9bb0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loginMutation.isPending}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.97 : 1 }],
                opacity: loginMutation.isPending ? 0.7 : 1,
              })}
              className="bg-primary rounded-xl py-4 items-center mt-2"
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#0d1b2a" />
              ) : (
                <Text className="text-background font-bold text-base">
                  Sign In
                </Text>
              )}
            </Pressable>

            <Link href="/auth/forgot-password" asChild>
              <Pressable className="items-center py-2">
                <Text className="text-muted text-sm">Forgot password?</Text>
              </Pressable>
            </Link>
          </View>

          {/* Footer */}
          <View className="mt-auto pt-8 items-center">
            <Text className="text-muted text-sm">
              Don't have an account?{" "}
              <Link href="/auth/signup">
                <Text className="text-primary font-semibold">
                  Start free trial
                </Text>
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
