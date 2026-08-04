import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";

interface User {
  id: number;
  email: string;
  role: string;
  subscriptionStatus: string;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-muted text-xs uppercase tracking-widest px-6 mb-2 mt-6">
      {title}
    </Text>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      className="bg-surface border-b border-border px-6 py-4 flex-row items-center justify-between"
    >
      <Text
        className={
          destructive ? "text-error font-semibold" : "text-foreground"
        }
      >
        {label}
      </Text>
      {value && <Text className="text-muted text-sm">{value}</Text>}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const [addingZone, setAddingZone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("auth_user").then((stored) => {
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {}
      }
    });
  }, []);

  const zonesQuery = trpc.zones.list.useQuery(undefined, { enabled: !!user });
  const utils = trpc.useUtils();

  const addZoneMutation = trpc.zones.add.useMutation({
    onSuccess: () => {
      setNewAddress("");
      setAddingZone(false);
      utils.zones.list.invalidate();
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Could not add address.");
    },
  });

  const deleteZoneMutation = trpc.zones.delete.useMutation({
    onSuccess: () => utils.zones.list.invalidate(),
  });

  const handleAddZone = () => {
    if (!newAddress.trim()) return;
    addZoneMutation.mutate({ address: newAddress.trim().toUpperCase() });
  };

  const handleDeleteZone = (id: number, address: string) => {
    Alert.alert(
      "Remove Zone",
      `Stop monitoring ${address}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteZoneMutation.mutate({ id }),
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const zones = zonesQuery.data ?? [];

  return (
    <ScrollView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-16 pb-4">
        <Text className="text-foreground text-2xl font-bold">Settings</Text>
      </View>

      {/* Account */}
      <SectionHeader title="Account" />
      <View className="rounded-2xl mx-4 overflow-hidden border border-border">
        <SettingsRow label="Email" value={user?.email ?? "—"} />
        <SettingsRow
          label="Subscription"
          value={user?.subscriptionStatus ?? "none"}
        />
        <SettingsRow label="Change Password" onPress={() => {}} />
      </View>

      {/* Monitored Zones */}
      <SectionHeader title="Monitored Addresses" />
      <View className="mx-4 rounded-2xl overflow-hidden border border-border">
        {zonesQuery.isLoading ? (
          <View className="p-6 items-center">
            <ActivityIndicator color="#22c55e" />
          </View>
        ) : zones.length === 0 ? (
          <View className="p-6 items-center">
            <Text className="text-muted text-sm text-center">
              No addresses added yet. Add one below.
            </Text>
          </View>
        ) : (
          zones.map((zone: any, idx: number) => (
            <View
              key={zone.id}
              className={`px-6 py-4 flex-row items-center justify-between ${
                idx < zones.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <View className="flex-1">
                <Text className="text-foreground font-medium">
                  {zone.streetNumber} {zone.streetName}
                </Text>
                <Text className="text-muted text-xs mt-0.5">
                  Milwaukee, WI · ±100 range
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  handleDeleteZone(
                    zone.id,
                    `${zone.streetNumber} ${zone.streetName}`
                  )
                }
                className="ml-4 p-2"
              >
                <Text className="text-error text-lg">✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Add Zone */}
      <View className="mx-4 mt-3">
        {addingZone ? (
          <View className="bg-surface border border-border rounded-2xl p-4 gap-3">
            <Text className="text-muted text-xs uppercase tracking-widest">
              Street Address
            </Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base"
              placeholder="e.g. 1912 NORTH 28TH STREET"
              placeholderTextColor="#8a9bb0"
              value={newAddress}
              onChangeText={setNewAddress}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleAddZone}
              autoFocus
            />
            <Text className="text-muted text-xs leading-5">
              Enter the street address where your car is parked. TKTAlert will
              monitor all complaints within ±100 house numbers.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setAddingZone(false);
                  setNewAddress("");
                }}
                className="flex-1 bg-border rounded-xl py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddZone}
                disabled={addZoneMutation.isPending || !newAddress.trim()}
                style={{ opacity: !newAddress.trim() ? 0.5 : 1 }}
                className="flex-1 bg-primary rounded-xl py-3 items-center"
              >
                {addZoneMutation.isPending ? (
                  <ActivityIndicator color="#0d1b2a" />
                ) : (
                  <Text className="text-background font-bold">Add Zone</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setAddingZone(true)}
            className="bg-surface border border-dashed border-primary/50 rounded-2xl py-4 items-center"
          >
            <Text className="text-primary font-semibold">+ Add Address</Text>
          </Pressable>
        )}
      </View>

      {/* Notifications */}
      <SectionHeader title="Notifications" />
      <View className="mx-4 rounded-2xl overflow-hidden border border-border">
        <View className="px-6 py-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-foreground">Push Notifications</Text>
            <Text className="text-muted text-xs mt-0.5">
              Instant alerts when a complaint is filed
            </Text>
          </View>
          <Switch
            value={true}
            onValueChange={() => {}}
            trackColor={{ false: "#2a3f55", true: "#22c55e" }}
            thumbColor="#f0ece4"
          />
        </View>
        <View className="px-6 py-4 flex-row items-center justify-between border-t border-border">
          <View className="flex-1">
            <Text className="text-foreground">SMS Alerts</Text>
            <Text className="text-muted text-xs mt-0.5">
              Requires phone number on account
            </Text>
          </View>
          <Switch
            value={false}
            onValueChange={() => {}}
            trackColor={{ false: "#2a3f55", true: "#22c55e" }}
            thumbColor="#f0ece4"
          />
        </View>
      </View>

      {/* Danger Zone */}
      <SectionHeader title="Account Actions" />
      <View className="mx-4 rounded-2xl overflow-hidden border border-border mb-12">
        <SettingsRow label="Sign Out" onPress={handleLogout} destructive />
      </View>
    </ScrollView>
  );
}
