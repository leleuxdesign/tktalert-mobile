import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

function AlertItem({ alert }: { alert: any }) {
  return (
    <View className="bg-surface border border-border rounded-2xl p-4 mx-6 mb-3">
      <View className="flex-row items-start gap-3">
        <View className="w-10 h-10 bg-warning/20 rounded-xl items-center justify-center mt-0.5">
          <Text>⚠️</Text>
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-semibold" numberOfLines={2}>
            {alert.complaintAddress ?? "Unknown address"}
          </Text>
          <View className="flex-row items-center gap-2 mt-1.5">
            <Text className="text-muted text-xs">
              {alert.sentAt ? new Date(alert.sentAt).toLocaleString() : "—"}
            </Text>
            {alert.channel && (
              <View className="bg-border px-2 py-0.5 rounded-full">
                <Text className="text-muted text-xs uppercase">
                  {alert.channel}
                </Text>
              </View>
            )}
          </View>
          {alert.complaintStatus && (
            <Text className="text-muted text-xs mt-1">
              Status: {alert.complaintStatus}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function AlertsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const alertsQuery = trpc.alerts.listMine.useQuery({ limit: 50 });

  const onRefresh = async () => {
    setRefreshing(true);
    await alertsQuery.refetch();
    setRefreshing(false);
  };

  const alerts = alertsQuery.data ?? [];

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-16 pb-4">
        <Text className="text-foreground text-2xl font-bold">Alert History</Text>
        <Text className="text-muted text-sm mt-1">
          All parking alerts sent to your account
        </Text>
      </View>

      {alertsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#22c55e" size="large" />
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <AlertItem alert={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#22c55e"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-6 pt-20">
              <Text style={{ fontSize: 48 }}>🔕</Text>
              <Text className="text-foreground text-xl font-bold mt-4 text-center">
                No alerts yet
              </Text>
              <Text className="text-muted text-sm mt-2 text-center leading-6">
                When a parking complaint is filed near your registered address,
                you'll see it here.
              </Text>
            </View>
          }
          contentContainerStyle={
            alerts.length === 0 ? { flex: 1 } : { paddingTop: 8, paddingBottom: 32 }
          }
        />
      )}
    </View>
  );
}
