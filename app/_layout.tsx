import "../global.css";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Platform } from "react-native";
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
      // Welcome, not login. Dropping a first-time installer onto a bare
      // credential form gave them nothing to decide with — no statement of what
      // the app does and no mention that coverage is Milwaukee-only. Anyone
      // returning can reach Sign In from there in one tap.
      router.replace("/auth/welcome");
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
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const savePushToken = trpc.auth.savePushToken.useMutation();
  const savedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!expoPushToken || !meQuery.data) return;
    if (savedTokenRef.current === expoPushToken) return;
    savedTokenRef.current = expoPushToken;
    savePushToken.mutate({ expoPushToken });
  }, [expoPushToken, meQuery.data]);

  /**
   * Diagnostic snapshot, sent once per signed-in launch.
   *
   * The Owner asked for device state on EVERY user, not only those who write
   * in, because the commonest support message is "it didn't alert me" and the
   * answer is usually push permission or a stale app version. Capturing it up
   * front means the answer is already on screen next to the message.
   *
   * Deliberately diagnostic only: version, platform, OS, model, and whether
   * push is actually usable. No location, no contacts, no advertising
   * identifiers. (Location is requested separately for the map picker and is
   * unrelated to this.)
   */
  const reportDevice = trpc.support.reportDevice.useMutation();
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!meQuery.data || reportedRef.current) return;
    reportedRef.current = true;
    (async () => {
      let pushPermission = "unavailable";
      try {
        const { status } = await Notifications.getPermissionsAsync();
        pushPermission = status;
      } catch {
        // Leave as "unavailable" — that is itself the useful signal.
      }
      reportDevice.mutate({
        appVersion: String(Constants.expoConfig?.version ?? ""),
        platform: Platform.OS,
        osVersion: String(Platform.Version ?? ""),
        deviceModel: [Device.brand, Device.modelName].filter(Boolean).join(" ") || undefined,
        pushPermission,
        hasPushToken: !!expoPushToken,
      });
    })();
  }, [meQuery.data, expoPushToken]);

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
