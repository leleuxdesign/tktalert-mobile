import { Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, AlertCircle, Settings } from "lucide-react-native";
import { gradients } from "@/lib/ios6-theme";

function TabIcon({ Icon, focused }: { Icon: typeof Bell; focused: boolean }) {
  return <Icon size={22} color={focused ? "#ffffff" : "#dde3ec"} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

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
