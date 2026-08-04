import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";

interface User {
  id: number;
  email: string;
  role: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
}

function SubscriptionBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    trialing: { label: "Free Trial", color: "#f59e0b", bg: "#2a1f0a" },
    active: { label: "Active", color: "#22c55e", bg: "#0a2a14" },
    comped: { label: "Comped", color: "#a78bfa", bg: "#1a0a2a" },
    lapsed: { label: "Expired", color: "#ef4444", bg: "#2a0a0a" },
    none: { label: "No Plan", color: "#8a9bb0", bg: "#1a2e42" },
  };
  const cfg = configs[status] ?? configs.none;
  return (
    <View
      style={{ backgroundColor: cfg.bg }}
      className="px-3 py-1 rounded-full"
    >
      <Text style={{ color: cfg.color }} className="text-xs font-bold">
        {cfg.label}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("auth_user").then((stored) => {
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {}
      }
    });
  }, []);

  const zonesQuery = trpc.zones.list.useQuery(undefined, {
    enabled: !!user,
  });

  const alertsQuery = trpc.alerts.listMine.useQuery(
    { limit: 5 },
    { enabled: !!user }
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([zonesQuery.refetch(), alertsQuery.refetch()]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
    router.replace("/auth/login");
  };

  const zones = zonesQuery.data ?? [];
  const recentAlerts = alertsQuery.data ?? [];

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#22c55e"
        />
      }
    >
      {/* Header */}
      <View className="px-6 pt-16 pb-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-muted text-sm">Welcome back</Text>
            <Text className="text-foreground text-xl font-bold" numberOfLines={1}>
              {user?.email ?? "..."}
            </Text>
          </View>
          {user && <SubscriptionBadge status={user.subscriptionStatus} />}
        </View>
      </View>

      {/* Active Zones */}
      <View className="px-6 mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-foreground font-bold text-base">
            Monitored Zones
          </Text>
          <Pressable onPress={() => router.push("/tabs/settings")}>
            <Text className="text-primary text-sm">Manage</Text>
          </Pressable>
        </View>

        {zonesQuery.isLoading ? (
          <ActivityIndicator color="#22c55e" />
        ) : zones.length === 0 ? (
          <View className="bg-surface border border-border rounded-2xl p-6 items-center">
            <Text style={{ fontSize: 32 }}>📍</Text>
            <Text className="text-foreground font-semibold mt-3">
              No zones set up yet
            </Text>
            <Text className="text-muted text-sm mt-1 text-center">
              Add your parking address to start receiving alerts
            </Text>
            <Pressable
              onPress={() => router.push("/tabs/settings")}
              className="mt-4 bg-primary rounded-xl px-6 py-3"
            >
              <Text className="text-background font-bold">Add Address</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3">
            {zones.map((zone: any) => (
              <View
                key={zone.id}
                className="bg-surface border border-border rounded-2xl p-4"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-10 h-10 bg-primary/20 rounded-xl items-center justify-center">
                      <Text>📍</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold" numberOfLines={1}>
                        {zone.streetNumber} {zone.streetName}
                      </Text>
                      <Text className="text-muted text-xs mt-0.5">
                        ±100 house numbers · Milwaukee, WI
                      </Text>
                    </View>
                  </View>
                  <View className="w-2 h-2 rounded-full bg-primary" />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Recent Alerts */}
      <View className="px-6 mb-8">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-foreground font-bold text-base">
            Recent Alerts
          </Text>
          <Pressable onPress={() => router.push("/tabs/alerts")}>
            <Text className="text-primary text-sm">View all</Text>
          </Pressable>
        </View>

        {alertsQuery.isLoading ? (
          <ActivityIndicator color="#22c55e" />
        ) : recentAlerts.length === 0 ? (
          <View className="bg-surface border border-border rounded-2xl p-6 items-center">
            <Text style={{ fontSize: 32 }}>✅</Text>
            <Text className="text-foreground font-semibold mt-3">
              No alerts yet
            </Text>
            <Text className="text-muted text-sm mt-1 text-center">
              You'll be notified the moment a complaint is filed near your car
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {recentAlerts.map((alert: any) => (
              <View
                key={alert.id}
                className="bg-surface border border-border rounded-2xl p-4"
              >
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 bg-warning/20 rounded-xl items-center justify-center mt-0.5">
                    <Text>⚠️</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold" numberOfLines={1}>
                      {alert.complaintAddress ?? "Unknown address"}
                    </Text>
                    <Text className="text-muted text-xs mt-1">
                      {alert.sentAt
                        ? new Date(alert.sentAt).toLocaleString()
                        : "—"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Subscription lapsed banner */}
      {user?.subscriptionStatus === "lapsed" && (
        <View className="mx-6 mb-6 bg-error/10 border border-error/30 rounded-2xl p-4">
          <Text className="text-error font-bold">Subscription Expired</Text>
          <Text className="text-muted text-sm mt-1">
            Renew to continue receiving parking alerts.
          </Text>
          <Pressable className="mt-3 bg-error rounded-xl py-3 items-center">
            <Text className="text-white font-bold">Renew Now</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
