import { useState, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable, Alert, Linking } from "react-native";
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
  graceUntil?: string | null;
}

const RENEW_URL = "https://app.tattletow.com/subscribe";
/** Key for the once-per-day throttle on the grace prompt. */
const GRACE_PROMPT_KEY = "grace_prompt_last_shown";

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

  // Daily renewal prompt while a failed payment is in its grace window.
  // The server sends push/email/SMS on the same 24h cadence; this covers the
  // case where notifications are denied or ignored — opening the app is the one
  // moment we're guaranteed to reach them before alerts stop.
  useEffect(() => {
    const graceUntil = user?.graceUntil;
    if (!graceUntil) return;

    const graceEnd = new Date(graceUntil).getTime();
    if (!Number.isFinite(graceEnd) || graceEnd <= Date.now()) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    let cancelled = false;

    AsyncStorage.getItem(GRACE_PROMPT_KEY).then((lastShown) => {
      if (cancelled || lastShown === todayKey) return;
      AsyncStorage.setItem(GRACE_PROMPT_KEY, todayKey);

      const daysLeft = Math.max(1, Math.ceil((graceEnd - Date.now()) / 86400000));
      Alert.alert(
        "Payment failed",
        `We couldn't process your payment. Your alerts stay on for ${daysLeft} more ` +
          `day${daysLeft !== 1 ? "s" : ""}, then they'll pause until you renew.\n\n` +
          `Nothing will be deleted — your watch zones stay exactly as they are.`,
        [
          { text: "Later", style: "cancel" },
          { text: "Renew Now", onPress: () => Linking.openURL(RENEW_URL) },
        ]
      );
    });

    return () => {
      cancelled = true;
    };
  }, [user?.graceUntil]);

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

  // A lapsed account is paused, not locked. The user keeps full read access to
  // their zones, alert history, and settings — only notifications stop. Blocking
  // the whole dashboard hid the very thing they need to see: that their data is
  // intact and what to do about it.
  const isPaused =
    user.subscriptionStatus === "lapsed" || (user.subscriptionStatus as string) === "cancelled";

  const graceEndMs = user.graceUntil ? new Date(user.graceUntil).getTime() : NaN;
  const graceDaysLeft =
    Number.isFinite(graceEndMs) && graceEndMs > Date.now()
      ? Math.max(1, Math.ceil((graceEndMs - Date.now()) / 86400000))
      : null;

  const zones = zonesQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  const isActiveStatus =
    user.subscriptionStatus === "active" || user.subscriptionStatus === "comped";
  const statusLabel = isActiveStatus ? "Active" : isPaused ? "Paused" : "Inactive";
  const statusColor = isActiveStatus ? colors.green : colors.red;

  return (
    <IosPage>
      <IosNavBar title="TattleTow" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
      >
        {isPaused && (
          <View style={styles.bannerWrap}>
            <View style={styles.pausedBanner}>
              <Text style={styles.pausedTitle}>⏸ Alerts paused</Text>
              <Text style={styles.pausedBody}>
                Your subscription ended, so we've stopped sending alerts. Nothing has been
                deleted —{" "}
                {zones.length > 0
                  ? `your ${zones.length} watch zone${zones.length !== 1 ? "s are" : " is"} saved and `
                  : "your account and history are intact and "}
                alerts resume automatically the moment you renew.
              </Text>
              {/*
                Points at the web app's real checkout. Revisit before the iOS
                submission in v1.5 — App Store rules on external purchase links
                are stricter than Play's, and Session 1 deliberately stripped
                purchase UI from the app for exactly that reason.
              */}
              <Text
                style={styles.pausedLink}
                onPress={() => Linking.openURL("https://app.tattletow.com/subscribe")}
              >
                Renew my subscription →
              </Text>
            </View>
          </View>
        )}

        {!isPaused && graceDaysLeft !== null && (
          <View style={styles.bannerWrap}>
            <View style={styles.graceBanner}>
              <Text style={styles.graceTitle}>
                ⚠️ Payment failed — {graceDaysLeft} day{graceDaysLeft !== 1 ? "s" : ""} left
              </Text>
              <Text style={styles.graceBody}>
                Your alerts are still running. Renew before the {graceDaysLeft} day
                {graceDaysLeft !== 1 ? "s are" : " is"} up and nothing changes.
              </Text>
              <Text style={styles.pausedLink} onPress={() => Linking.openURL(RENEW_URL)}>
                Renew my subscription →
              </Text>
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
              <Text style={styles.activityTitle}>
                {isPaused ? "⏸ Watching paused" : "👀 TattleTow is watching"}
              </Text>
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
            <Text style={styles.activityFootnote}>Total complaints scanned by TattleTow</Text>
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

const styles = StyleSheet.create({
  graceBanner: {
    backgroundColor: "#fff4e0",
    borderWidth: 1,
    borderColor: "#e8c07a",
    borderRadius: 10,
    padding: 14,
  },
  graceTitle: { fontSize: 15, fontWeight: "700", color: "#7a4c00", fontFamily, marginBottom: 6 },
  graceBody: { fontSize: 13, color: "#7a4c00", fontFamily, lineHeight: 19 },
  pausedBanner: {
    backgroundColor: "#fdecea",
    borderWidth: 1,
    borderColor: "#f0b4ae",
    borderRadius: 10,
    padding: 14,
  },
  pausedTitle: { fontSize: 15, fontWeight: "700", color: "#8c1d13", fontFamily, marginBottom: 6 },
  pausedBody: { fontSize: 13, color: "#8c1d13", fontFamily, lineHeight: 19 },
  pausedLink: { fontSize: 14, fontWeight: "700", color: "#1a7fd4", fontFamily, marginTop: 10 },
  center: { alignItems: "center", justifyContent: "center" },
  bannerWrap: { marginBottom: 16 },
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
});
