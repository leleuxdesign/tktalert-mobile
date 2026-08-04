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

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data: any) => {
      if (data?.token && data?.user) {
        await Promise.all([
          AsyncStorage.setItem("auth_token", data.token),
          AsyncStorage.setItem("auth_user", JSON.stringify(data.user)),
        ]);
        // Go to address setup after signup
        router.replace("/tabs/dashboard");
      }
    },
    onError: (err: any) => {
      Alert.alert(
        "Sign Up Failed",
        err.message || "Could not create account. Please try again."
      );
    },
  });

  const handleSignup = () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing Fields", "Email and password are required.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }
    registerMutation.mutate({
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim() || undefined,
    });
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
        <View className="flex-1 px-6 pt-16 pb-10">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-foreground text-3xl font-bold">
              Start your free trial
            </Text>
            <Text className="text-muted text-sm mt-2">
              7 days free, then $4.50/month. Cancel anytime.
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
                placeholder="Min. 8 characters"
                placeholderTextColor="#8a9bb0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="text-muted text-xs uppercase tracking-widest mb-2">
                Phone{" "}
                <Text className="text-muted normal-case text-xs">(optional — for SMS alerts)</Text>
              </Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-base"
                placeholder="+1 (414) 555-0100"
                placeholderTextColor="#8a9bb0"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />
            </View>

            <Pressable
              onPress={handleSignup}
              disabled={registerMutation.isPending}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.97 : 1 }],
                opacity: registerMutation.isPending ? 0.7 : 1,
              })}
              className="bg-primary rounded-xl py-4 items-center mt-2"
            >
              {registerMutation.isPending ? (
                <ActivityIndicator color="#0d1b2a" />
              ) : (
                <Text className="text-background font-bold text-base">
                  Create Account
                </Text>
              )}
            </Pressable>

            {/* Legal disclaimer */}
            <Text className="text-muted text-xs text-center leading-5 mt-2">
              TKTAlert monitors public city data. Alerts are informational only
              and do not guarantee ticket prevention. By signing up you agree to
              our Terms of Service.
            </Text>
          </View>

          {/* Footer */}
          <View className="mt-auto pt-8 items-center">
            <Text className="text-muted text-sm">
              Already have an account?{" "}
              <Link href="/auth/login">
                <Text className="text-primary font-semibold">Sign in</Text>
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
