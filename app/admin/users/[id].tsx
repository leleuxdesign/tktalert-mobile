import { useEffect, useState } from "react";
import { View, Text, ScrollView, Switch, Pressable, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, CheckCircle2, XCircle, MapPin, Save } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily, cardShadow } from "@/lib/ios6-theme";
import { SERVICE_AREAS, ServiceArea } from "@/lib/supported-locations";
import {
  IosPage,
  IosNavBar,
  IosCard,
  IosBadge,
  IosButton,
  IosInput,
  IosSectionLabel,
  IosServiceAreaPicker,
  IosErrorBanner,
} from "@/components/ios6";

const STATUS_OPTIONS = ["trial", "active", "lapsed", "cancelled", "comped"] as const;

function statusGradient(status: string) {
  if (status === "active" || status === "comped") return gradients.badgeGreen;
  if (status === "trial") return gradients.badgeOrange;
  return gradients.badgeRed;
}

const emptyZoneDraft = {
  houseNumber: "",
  street: "",
  label: "",
  area: SERVICE_AREAS[0] as ServiceArea,
};

export default function AdminUserDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const utils = trpc.useUtils();

  const userQuery = trpc.adminUsers.get.useQuery({ userId }, { enabled: !!userId });
  const zonesQuery = trpc.adminUsers.getZones.useQuery({ userId }, { enabled: !!userId });
  const alertsQuery = trpc.adminUsers.getAlerts.useQuery({ userId, limit: 50 }, { enabled: !!userId });
  const user = userQuery.data?.user;

  const [status, setStatus] = useState<string>("trial");
  const [role, setRole] = useState<string>("user");
  const [isComped, setIsComped] = useState(false);

  useEffect(() => {
    if (user) {
      setStatus(user.subscriptionStatus);
      setRole(user.role);
      setIsComped(!!user.isComped);
    }
  }, [user]);

  const updateUser = trpc.adminUsers.update.useMutation({
    onSuccess: () => {
      userQuery.refetch();
      utils.adminUsers.list.invalidate();
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Could not update user."),
  });

  const [showAddZone, setShowAddZone] = useState(false);
  const [newZone, setNewZone] = useState(emptyZoneDraft);
  const [zoneError, setZoneError] = useState("");

  const createZone = trpc.adminUsers.createZone.useMutation({
    onSuccess: () => {
      utils.adminUsers.getZones.invalidate({ userId });
      setShowAddZone(false);
      setNewZone(emptyZoneDraft);
      setZoneError("");
    },
    onError: (err: any) => setZoneError(err.message || "Could not add zone."),
  });

  const handleAddZone = () => {
    setZoneError("");
    if (!newZone.street.trim() || !newZone.houseNumber) {
      setZoneError("House number and street are required.");
      return;
    }
    createZone.mutate({
      userId,
      street: newZone.street.trim(),
      centerAddress: Number(newZone.houseNumber),
      label: newZone.label.trim() || undefined,
      city: newZone.area.city,
      state: newZone.area.state,
    });
  };

  if (userQuery.isLoading) {
    return (
      <IosPage style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </IosPage>
    );
  }

  if (!user) {
    return (
      <IosPage>
        <IosNavBar title="User" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.emptyText}>User not found.</Text>
        </View>
      </IosPage>
    );
  }

  const zones = zonesQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  return (
    <IosPage>
      <IosNavBar title="Admin · User" onBack={() => router.back()} backLabel="Users" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Header card */}
        <IosCard style={{ padding: 16, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user.name ?? user.username ?? "U")[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerName}>{user.name ?? user.username ?? "—"}</Text>
              <Text style={styles.headerEmail}>{user.email ?? "—"}</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                <IosBadge gradient={statusGradient(user.subscriptionStatus)}>{user.subscriptionStatus}</IosBadge>
                {user.isComped ? <IosBadge gradient={gradients.iconPurple}>COMP</IosBadge> : null}
                {user.role === "admin" ? <IosBadge gradient={gradients.badgeOrange}>ADMIN</IosBadge> : null}
              </View>
            </View>
          </View>
        </IosCard>

        {/* Edit form */}
        <IosSectionLabel>Edit User</IosSectionLabel>
        <IosCard style={{ padding: 16, marginBottom: 20 }}>
          <Text style={styles.fieldLabel}>Subscription Status</Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((s) => (
              <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipActive]}>
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Role</Text>
          <View style={styles.chipRow}>
            {["user", "admin"].map((r) => (
              <Pressable key={r} onPress={() => setRole(r)} style={[styles.chip, role === r && styles.chipActive]}>
                <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Comped (free access)</Text>
            <Switch
              value={isComped}
              onValueChange={setIsComped}
              trackColor={{ false: "#78788033", true: colors.green }}
            />
          </View>

          <View style={{ marginTop: 16 }}>
            <IosButton
              variant="blue"
              loading={updateUser.isPending}
              onPress={() =>
                updateUser.mutate({ userId, subscriptionStatus: status as any, role: role as any, isComped })
              }
            >
              <View style={styles.saveBtnContent}>
                <Save size={14} color="#fff" />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </View>
            </IosButton>
          </View>
        </IosCard>

        {/* Watch zones */}
        <IosSectionLabel>Watch Zones ({zones.length})</IosSectionLabel>
        <IosCard style={{ marginBottom: 12 }}>
          {zones.length > 0 ? (
            zones.map((zone: any, i: number) => (
              <View key={zone.id} style={[styles.zoneRow, i < zones.length - 1 && styles.zoneRowBorder]}>
                <View style={styles.zoneIcon}>
                  <MapPin size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneTitle}>{zone.label ?? zone.street}</Text>
                  <Text style={styles.zoneSubtitle}>
                    {zone.street} · #{zone.addressMin}–{zone.addressMax}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.zoneRow}>
              <Text style={styles.emptyText}>No watch zones.</Text>
            </View>
          )}
        </IosCard>

        {!showAddZone ? (
          <View style={{ marginBottom: 20 }}>
            <IosButton variant="silver" onPress={() => setShowAddZone(true)}>
              + Add Watch Zone
            </IosButton>
          </View>
        ) : (
          <IosCard style={{ padding: 16, marginBottom: 20 }}>
            <Text style={styles.addZoneTitle}>New Watch Zone</Text>
            <View style={{ gap: 12 }}>
              <View>
                <Text style={styles.fieldLabel}>House Number</Text>
                <IosInput
                  placeholder="e.g. 1234"
                  keyboardType="number-pad"
                  value={newZone.houseNumber}
                  onChangeText={(v) => setNewZone((z) => ({ ...z, houseNumber: v }))}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Street Name</Text>
                <IosInput
                  placeholder="e.g. N Milwaukee St"
                  value={newZone.street}
                  onChangeText={(v) => setNewZone((z) => ({ ...z, street: v }))}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Service Area</Text>
                <IosServiceAreaPicker value={newZone.area} onChange={(area) => setNewZone((z) => ({ ...z, area }))} />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Label (optional)</Text>
                <IosInput
                  placeholder="e.g. Work parking"
                  value={newZone.label}
                  onChangeText={(v) => setNewZone((z) => ({ ...z, label: v }))}
                />
              </View>
              {zoneError ? <IosErrorBanner>{zoneError}</IosErrorBanner> : null}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <IosButton
                  variant="silver"
                  flex={1}
                  onPress={() => {
                    setShowAddZone(false);
                    setNewZone(emptyZoneDraft);
                    setZoneError("");
                  }}
                >
                  Cancel
                </IosButton>
                <IosButton variant="blue" flex={2} onPress={handleAddZone} loading={createZone.isPending}>
                  Add Zone
                </IosButton>
              </View>
            </View>
          </IosCard>
        )}

        {/* Alert history */}
        <IosSectionLabel>Alert History ({alerts.length})</IosSectionLabel>
        <IosCard>
          {alertsQuery.isLoading ? (
            <View style={styles.zoneRow}>
              <ActivityIndicator color={colors.blue} />
            </View>
          ) : alerts.length === 0 ? (
            <View style={styles.zoneRow}>
              <Text style={styles.emptyText}>No complaint alerts sent yet.</Text>
            </View>
          ) : (
            alerts.map((alert: any, i: number) => (
              <View key={alert.id} style={[styles.zoneRow, i < alerts.length - 1 && styles.zoneRowBorder]}>
                <View
                  style={[
                    styles.zoneIcon,
                    { backgroundColor: alert.success ? colors.red : colors.silver },
                  ]}
                >
                  <Bell size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneTitle}>Alert via {String(alert.channel).toUpperCase()}</Text>
                  <Text style={styles.zoneSubtitle}>
                    Complaint #{alert.complaintId} · Zone #{alert.zoneId}
                  </Text>
                  <Text style={styles.alertTimestamp}>{new Date(alert.sentAt).toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {alert.success ? (
                    <CheckCircle2 size={16} color={colors.green} />
                  ) : (
                    <XCircle size={16} color={colors.red} />
                  )}
                  <Text style={styles.readLabel}>{alert.readAt ? "Read" : "Unread"}</Text>
                </View>
              </View>
            ))
          )}
        </IosCard>
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, color: colors.textLight, fontFamily },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: "#fff", fontFamily },
  headerName: { fontSize: 17, fontWeight: "700", color: colors.text, fontFamily },
  headerEmail: { fontSize: 13, color: colors.textLight, fontFamily },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6,
    fontFamily,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.blue, borderColor: colors.blueDark },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.text, fontFamily },
  chipTextActive: { color: "#fff" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  toggleLabel: { fontSize: 14, color: colors.text, fontFamily },
  saveBtnContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveBtnText: { fontSize: 17, fontWeight: "700", color: "#fff", fontFamily },
  addZoneTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 14, fontFamily },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  zoneRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  zoneIcon: {
    width: 29,
    height: 29,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue,
  },
  zoneTitle: { fontSize: 14, fontWeight: "600", color: colors.text, fontFamily },
  zoneSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 1, fontFamily },
  alertTimestamp: { fontSize: 11, color: colors.textFaint, marginTop: 1, fontFamily },
  readLabel: { fontSize: 11, color: colors.textFaint, fontFamily },
});
