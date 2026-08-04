import { Tabs } from "expo-router";
import { Text, View } from "react-native";

function TabIcon({
  emoji,
  focused,
}: {
  emoji: string;
  focused: boolean;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: focused ? 1 : 0.5,
      }}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1a2e42",
          borderTopColor: "#2a3f55",
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#8a9bb0",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🔔" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
