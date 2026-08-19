import { useState, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { useRouter, Link } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bell, AlertCircle, ChevronRight, Car } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import {
  IosPage,
  IosNavBar,
  IosStatCard,
  IosSectionLabel,
  IosTable,
  IosTableRow,
  IosTableRowLabel,
  IosIconCell,
  IosButton,
  IosCard,
  IosZoneTile,
  IosDisclaimerModal,
} from "@/components/ios6";

interface User {
  id: number;
  email: string;
  role: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [cachedUser, setCachedUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("auth_user").then((stored) => {
      if (stored) {
        try {
          setCachedUser(JSON.parse(stored));
        } catch {}
      }
    });
  }, []);

  const meQuery = trpc.auth.me.useQuery();
  const user: User | null = meQuery.data ?? cachedUser;

  const zonesQuery = trpc.zones.list.useQuery(undefined, { enabled: !!user });
  const alertsQuery = trpc.alerts.myAlerts.useQuery({ limit: 5 }, { enabled: !!user });
  const activityQuery = trpc.alerts.activitySummary.useQuery(undefined, { enabled: !!user });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([zonesQuery.refetch(), alertsQuery.refetch(), meQuery.refetch(), activityQuery.refetch()]);
    setRefreshing(false);
  };

  if (meQuery.isLoading && !cachedUser) {
    return (
      <IosPage style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </IosPage>
    );
  }

  if (!user) return null; // AuthGuard in root layout handles redirect to login

  if (user.subscriptionStatus === "lapsed" || (user.subscriptionStatus as string) === "cancelled") {
    return <RenewScreen />;
  }

  const trialDaysLeft = user.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  const zones = zonesQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  const isActiveStatus =
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "comped" ||
    user.subscriptionStatus === "trial";
  const statusLabel = isActiveStatus ? "Active" : "Inactive";
  const statusColor = isActiveStatus ? colors.green : colors.red;

  return (
    <IosPage>
      <IosNavBar title="TKTAlert" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
      >
        {user.subscriptionStatus === "trial" && trialDaysLeft !== null && (
          <View style={styles.trialBannerWrap}>
            <View style={styles.trialBanner}>
              <Text style={styles.trialText}>
                🕐 {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in free trial
              </Text>
              <Text style={styles.trialSubtext}>Subscribe at tktalert.net</Text>
            </View>
          </View>
        )}

        <View style={styles.statsRow}>
          <IosStatCard label="Status" value={<Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>} />
          <IosStatCard label="Zones" value={String(zones.length)} />
          <IosStatCard label="Alerts" value={String(alerts.length)} />
        </View>

        {zones.length > 0 && (
          <IosCard style={styles.activityCard}>
            <View style={styles.activityHeaderRow}>
              <Text style={styles.activityTitle}>👀 TKTAlert is watching</Text>
              <Pressable onPress={() => setDisclaimerVisible(true)} hitSlop={8} style={styles.disclaimerBtn}>
                <Car size={14} color={colors.textLight} />
              </Pressable>
            </View>
            <View style={styles.activityRow}>
              <View style={styles.activityStat}>
                <Text style={styles.activityValue}>{activityQuery.data?.today ?? 0}</Text>
                <Text style={styles.activityLabel}>Today</Text>
              </View>
              <View style={styles.activityDivider} />
              <View style={styles.activityStat}>
                <Text style={styles.activityValue}>{activityQuery.data?.thisWeek ?? 0}</Text>
                <Text style={styles.activityLabel}>This Week</Text>
              </View>
              <View style={styles.activityDivider} />
              <View style={styles.activityStat}>
                <Text style={styles.activityValue}>{activityQuery.data?.thisMonth ?? 0}</Text>
                <Text style={styles.activityLabel}>This Month</Text>
              </View>
            </View>
            <Text style={styles.activityFootnote}>Total complaints scanned by TKTAlert</Text>
          </IosCard>
        )}

        <View style={{ marginBottom: 20 }}>
          <View style={styles.sectionHeaderRow}>
            <IosSectionLabel>Watch Zones</IosSectionLabel>
            <Text style={styles.manageLink} onPress={() => router.push("/watch-zones")}>
              Manage →
            </Text>
          </View>
          {zones.length > 0 ? (
            <View style={styles.tileRow}>
              {zones.map((zone: any, i: number) => (
                <IosZoneTile
                  key={zone.id}
                  label={zone.label ?? zone.street}
                  street={zone.street}
                  addressRange={`${zone.addressMin}–${zone.addressMax}`}
                  gradient={i % 2 === 0 ? gradients.iconBlue : gradients.iconGreen}
                  onPress={() => router.push("/watch-zones")}
                />
              ))}
            </View>
          ) : (
            <IosCard style={styles.emptyZonesCard}>
              <Text style={styles.emptyText}>No watch zones yet.</Text>
              <IosButton variant="silver" onPress={() => router.push("/watch-zones")}>
                + Add Watch Zone
              </IosButton>
            </IosCard>
          )}
        </View>

        <View>
          <IosSectionLabel>Recent Alerts</IosSectionLabel>
          <IosTable>
            {alerts.length > 0 ? (
              alerts.map((alert: any) => (
                <IosTableRow key={alert.id} last={false}>
                  <IosIconCell gradient={gradients.iconRed}>
                    <Bell size={16} color="#fff" />
                  </IosIconCell>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Alert via {String(alert.channel).toUpperCase()}</Text>
                    <Text style={styles.rowSubtitle}>{new Date(alert.sentAt).toLocaleString()}</Text>
                  </View>
                </IosTableRow>
              ))
            ) : (
              <View style={styles.emptyAlertsBox}>
                <Bell size={28} color={colors.silver} />
                <Text style={styles.emptyText}>No alerts yet.</Text>
                <Text style={styles.emptySubtext}>You'll be notified when a complaint is filed near your zone.</Text>
              </View>
            )}
            {alerts.length > 0 && (
              <Link href="/tabs/alerts" asChild>
                <IosTableRow onPress={() => {}} last>
                  <IosIconCell gradient={gradients.iconPurple}>
                    <AlertCircle size={16} color="#fff" />
                  </IosIconCell>
                  <IosTableRowLabel>View All Alerts</IosTableRowLabel>
                  <ChevronRight size={16} color={colors.silver} />
                </IosTableRow>
              </Link>
            )}
          </IosTable>
        </View>
      </ScrollView>
      <IosDisclaimerModal visible={disclaimerVisible} onClose={() => setDisclaimerVisible(false)} />
    </IosPage>
  );
}

function RenewScreen() {
  return (
    <IosPage style={styles.center}>
      <View style={{ alignItems: "center", paddingHorizontal: 20 }}>
        <View style={styles.renewIcon}>
          <Bell size={36} color="#fff" />
        </View>
        <Text style={styles.renewTitle}>Subscription Lapsed</Text>
        <Text style={styles.renewBody}>
          Renew to continue receiving parking complaint alerts for your watch zones.
        </Text>
        <Text style={styles.renewLink}>Manage your subscription at tktalert.net</Text>
      </View>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  trialBannerWrap: { marginBottom: 16 },
  trialBanner: {
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: "#ffb400",
    borderRadius: 10,
  },
  trialText: { fontSize: 14, fontWeight: "600", color: "#5a3800", fontFamily },
  trialSubtext: { fontSize: 12, fontWeight: "600", color: "#5a3800", fontFamily, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  activityCard: { padding: 14, marginBottom: 20 },
  activityHeaderRow: { marginBottom: 10, position: "relative", justifyContent: "center" },
  activityTitle: { fontSize: 13, fontWeight: "700", color: colors.text, fontFamily, textAlign: "center" },
  disclaimerBtn: { position: "absolute", right: 0, top: -2, padding: 2 },
  activityRow: { flexDirection: "row", alignItems: "center" },
  activityStat: { flex: 1, alignItems: "center" },
  activityDivider: { width: 1, height: 30, backgroundColor: colors.separator },
  activityValue: { fontSize: 22, fontWeight: "700", color: colors.blue, fontFamily },
  activityLabel: { fontSize: 11, color: colors.textLight, fontFamily, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  activityFootnote: { fontSize: 11, color: colors.textFaint, fontFamily, textAlign: "center", marginTop: 10 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  manageLink: { fontSize: 13, fontWeight: "700", color: colors.blue, fontFamily, marginBottom: 8 },
  tileRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  emptyZonesCard: { alignItems: "center", gap: 10, paddingVertical: 20 },
  statusText: { fontWeight: "700", fontSize: 13, fontFamily },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text, fontFamily },
  rowSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 1, fontFamily },
  emptyText: { fontSize: 14, color: colors.textLight, fontFamily },
  emptySubtext: { fontSize: 12, color: colors.textFaint, marginTop: 2, textAlign: "center", fontFamily },
  emptyAlertsBox: { alignItems: "center", paddingVertical: 16, gap: 4 },
  renewIcon: { width: 72, height: 72, borderRadius: 16, backgroundColor: colors.red, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  renewTitle: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 6, fontFamily },
  renewBody: { fontSize: 14, color: colors.textLight, textAlign: "center", marginBottom: 28, fontFamily },
  renewLink: { fontSize: 14, fontWeight: "700", color: colors.blue, textAlign: "center", fontFamily },
});
