import { useEffect, useRef } from "react";
import { Tabs, useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, AlertCircle, Settings } from "lucide-react-native";
import { gradients } from "@/lib/ios6-theme";

function TabIcon({ Icon, focused }: { Icon: typeof Bell; focused: boolean }) {
  return <Icon size={22} color={focused ? "#ffffff" : "#dde3ec"} />;
}

/** Once per account per app launch, so backing out of "add a zone" doesn't loop. */
let zonePromptShownFor: number | null = null;

/**
 * IAP-CONTRACT.md §2.1: accounts created outside the app's signup wizard (the
 * temporary web signup form, admin) arrive with `consentGivenAt` null and no
 * watch zones. Before anything else they acknowledge the service disclaimer
 * (app/consent.tsx); then, if they have no zones, they're sent to add one.
 * Accounts from the in-app wizard already have both, so this never fires.
 */
function useOnboardingGate() {
  const router = useRouter();
  const meQuery = trpc.auth.me.useQuery();
  const me = meQuery.data as { id?: number; consentGivenAt?: string | null } | null | undefined;
  const hasConsent = !!me?.consentGivenAt;
  const zonesQuery = trpc.zones.list.useQuery(undefined, { enabled: !!me && hasConsent });
  const consentShown = useRef(false);

  useEffect(() => {
    if (!me) return;
    if (!hasConsent) {
      if (!consentShown.current) {
        consentShown.current = true;
        router.push("/consent");
      }
      return;
    }
    consentShown.current = false;
    const userId = me.id ?? null;
    if (zonePromptShownFor !== userId && zonesQuery.isSuccess && zonesQuery.data.length === 0) {
      zonePromptShownFor = userId;
      router.push("/watch-zones");
    }
  }, [me, hasConsent, zonesQuery.isSuccess, zonesQuery.data]);
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  useOnboardingGate();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "#dde3ec",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
        tabBarStyle: {
          height: 49 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 4,
          borderTopWidth: 1,
          borderTopColor: "#3a4455",
        },
        tabBarBackground: () => (
          <LinearGradient colors={gradients.navbar as any} style={{ flex: 1 }} />
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: ({ focused }) => <TabIcon Icon={Bell} focused={focused} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: "Alerts", tabBarIcon: ({ focused }) => <TabIcon Icon={AlertCircle} focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ focused }) => <TabIcon Icon={Settings} focused={focused} /> }}
      />
    </Tabs>
  );
}
