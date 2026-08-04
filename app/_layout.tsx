import "../global.css";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const trpcClient = createTRPCClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    AsyncStorage.getItem("auth_token").then((token) => {
      setIsAuthenticated(!!token);
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === "auth";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/tabs/dashboard");
    }
  }, [isReady, isAuthenticated, segments]);

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function PushNotificationSetup() {
  const { expoPushToken } = usePushNotifications();
  // TODO: send expoPushToken to backend when user is authenticated
  return null;
}

export default function RootLayout() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <PushNotificationSetup />
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="auth" />
            <Stack.Screen name="tabs" />
          </Stack>
        </AuthGuard>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
