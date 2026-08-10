import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { colors } from "@/lib/ios6-theme";

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
  const router = useRouter();
  const segments = useSegments();
  // The backend authenticates via an HttpOnly session cookie, which isn't
  // readable from JS — ask the server whether the current cookie is valid.
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (meQuery.isLoading) return;

    const isAuthenticated = !!meQuery.data;
    const inAuthGroup = segments[0] === "auth";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/tabs/dashboard");
    }
  }, [meQuery.isLoading, meQuery.data, segments]);

  if (meQuery.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.blue} size="large" />
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
        <StatusBar style="dark" />
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
