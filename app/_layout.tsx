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
  /*
    The token is claimed per ACCOUNT, not per app process.

    `savedTokenRef` alone was a process-lifetime "already saved" flag, which was
    fine while a token could sit on several accounts at once. It cannot any
    more: the server clears the token from every other account when one claims
    it (tktalert-app `50f6ea6`, UNIQUE(expoPushToken)), and signing out releases
    it (`8d58091`). So sign out and back in within one session and the token now
    belongs to nobody, while this ref still says "saved" — that account gets no
    push alerts at all until the app is relaunched.

    Pairing the ref with the user it was saved for fixes it: a change of signed-
    in account (including to signed-out and back) forgets the save and the next
    sign-in re-claims.
  */
  const savedTokenRef = useRef<string | null>(null);
  const savedForUserRef = useRef<number | null>(null);

  useEffect(() => {
    const userId: number | null = meQuery.data?.id ?? null;

    if (savedForUserRef.current !== userId) {
      savedForUserRef.current = userId;
      savedTokenRef.current = null;
    }

    if (!expoPushToken || userId == null) return;
    if (savedTokenRef.current === expoPushToken) return;
    savedTokenRef.current = expoPushToken;
    savePushToken.mutate({ expoPushToken });
  }, [expoPushToken, meQuery.data]);

  /**
   * Diagnostic snapshot, sent once per signed-in ACCOUNT per launch.
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
   *
   * Paired with the user id for the same reason as the push-token save above:
   * a bare once-per-process flag meant a second account signing in during one
   * session was never profiled at all, so the admin view would show nothing for
   * exactly the person who had just been helped into the app.
   */
  const reportDevice = trpc.support.reportDevice.useMutation();
  const reportedForUserRef = useRef<number | null>(null);
  useEffect(() => {
    const userId: number | null = meQuery.data?.id ?? null;
    if (userId == null || reportedForUserRef.current === userId) return;
    reportedForUserRef.current = userId;
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
