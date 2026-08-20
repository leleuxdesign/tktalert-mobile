import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart2, Users, FileText, Bell, Activity } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients } from "@/lib/ios6-theme";

function TabIcon({ Icon, focused }: { Icon: typeof BarChart2; focused: boolean }) {
  return <Icon size={20} color={focused ? "#ffffff" : "#dde3ec"} />;
}

export default function AdminLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const meQuery = trpc.auth.me.useQuery();

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (meQuery.data?.role !== "admin") {
      router.replace("/tabs/settings");
    }
  }, [meQuery.isLoading, meQuery.data]);

  if (meQuery.isLoading || meQuery.data?.role !== "admin") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

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
        name="index"
        options={{ title: "Overview", tabBarIcon: ({ focused }) => <TabIcon Icon={BarChart2} focused={focused} /> }}
      />
      <Tabs.Screen
        name="users"
        options={{ title: "Users", tabBarIcon: ({ focused }) => <TabIcon Icon={Users} focused={focused} /> }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: "Complaints", tabBarIcon: ({ focused }) => <TabIcon Icon={FileText} focused={focused} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: "Alerts", tabBarIcon: ({ focused }) => <TabIcon Icon={Bell} focused={focused} /> }}
      />
      <Tabs.Screen
        name="scan-log"
        options={{ title: "Scan Log", tabBarIcon: ({ focused }) => <TabIcon Icon={Activity} focused={focused} /> }}
      />
    </Tabs>
  );
}
