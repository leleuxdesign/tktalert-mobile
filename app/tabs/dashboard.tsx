import { useState, useEffect } from "react";
import { describeSubscription } from "../../lib/subscription";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable, Alert, AppState } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bell, AlertCircle, ChevronRight, Car } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { useCheckout } from "@/lib/useCheckout";
import { useSmsAlertsPrompt } from "@/hooks/useSmsAlertsPrompt";
import { colors, gradients, fontFamily, zoneColor } from "@/lib/ios6-theme";
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
  /** Used only to word the text-alerts prompt; Settings owns the field itself. */
  phone?: string | null;
  /** Non-null = express SMS consent on file. Null on a paid account = no texts. */
  smsConsentAt?: string | null;
}

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

  // Entitlement, as the server sees it. Needed here (not just on the Map and in
  // Settings) because the free→paid moment is what triggers the text-alerts ask.
  const accessQuery = trpc.map.access.useQuery();

  // App-started Stripe checkout (see lib/useCheckout.ts), shared with the
  // Tattle Map's upgrade prompts.
  const { startCheckout, isPending: checkoutPending } = useCheckout();

  // Returning from Stripe in the browser: refresh so a new subscription shows
  // as active without the customer needing to know to pull down. `map.access`
  // rides along — it carries the tier and channel set the text-alerts prompt
  // triggers on, so refreshing only `me` would leave the app entitled but
  // still believing SMS is locked.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        meQuery.refetch();
        accessQuery.refetch();
      }
    });
    return () => subscription.remove();
  }, []);

  /*
    A subscriber with no SMS consent on file is paying for a channel that will
    never fire: the server refuses every send without `smsConsentAt`. Most of
    them are in that state honestly — a free account couldn't receive texts, so
    the signup checkbox was correctly left unchecked. Ask them once. The rule is
    a state (paid + SMS available + no consent + never asked), not the moment of
    purchase, because people subscribe on the WEB and may install the app after,
    where there is no purchase moment for the app to see. Consent itself is
    recorded only in Settings, which carries the filed A2P disclosures.
  */
  useSmsAlertsPrompt({
    access: accessQuery.data,
    userId: meQuery.data?.id ?? null,
    hasConsent: !!meQuery.data?.smsConsentAt,
    hasPhone: !!meQuery.data?.phone?.trim(),
    onOpenSettings: () =>
      router.push({
        pathname: "/tabs/settings",
        // `focus` opens the phone field for editing; `t` makes each arrival a
        // distinct param set, so returning to Settings re-opens it.
        params: { focus: "phone", t: String(Date.now()) },
      }),
  });

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
          { text: "Renew Now", onPress: startCheckout },
        ]
      );
    });

    return () => {
      cancelled = true;
    };
  }, [user?.graceUntil]);

  const zonesQuery = trpc.zones.list.useQuery(undefined, { enabled: !!user });
  // Fetch the same 100 the Alert History screen does: the "Alerts" tile used to
  // count this list while it was capped at 5, so it could never read above 5.
  const alertsQuery = trpc.alerts.myAlerts.useQuery({ limit: 100 }, { enabled: !!user });
  const activityQuery = trpc.alerts.activitySummary.useQuery(undefined, { enabled: !!user });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      zonesQuery.refetch(),
      alertsQuery.refetch(),
      meQuery.refetch(),
      activityQuery.refetch(),
      accessQuery.refetch(),
    ]);
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
  // Derived from the shared helper so Settings and the Dashboard cannot drift
  // into describing one state two different ways, which is what happened when
  // each screen mapped the enum for itself.
  const plan = describeSubscription(user);
  const isPaused = plan.paused;

  const graceEndMs = user.graceUntil ? new Date(user.graceUntil).getTime() : NaN;
  const graceDaysLeft =
    Number.isFinite(graceEndMs) && graceEndMs > Date.now()
      ? Math.max(1, Math.ceil((graceEndMs - Date.now()) / 86400000))
      : null;

  const zones = zonesQuery.data ?? [];
  const allAlerts = alertsQuery.data ?? [];
  const alerts = allAlerts.slice(0, 5);
  const alertCount = allAlerts.length >= 100 ? "100+" : String(allAlerts.length);

  const isActiveStatus = plan.entitled;
  const statusLabel = plan.badge;
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
              <Text style={styles.pausedTitle}>
                {plan.neverSubscribed ? "🔔 Push alerts only" : "⏸ Text and email alerts paused"}
              </Text>
              {/*
                A user who has never subscribed must not be told their
                subscription "ended" — it is false, and it is the first thing a
                new account sees. `subscribedAt` is null until Stripe reports a
                completed checkout, which is what separates the two cases.
              */}
              {/*
                Owner ruling 2026-09-18: free accounts DO get alerts — push, on
                one zone. Only text and email alerts, and extra zones, are paid,
                so this banner must never say alerts are off.
              */}
              <Text style={styles.pausedBody}>
                {plan.neverSubscribed ? (
                  <>
                    You're on the free plan: push alerts on 1 watch zone.{" "}
                    {zones.length > 1
                      ? `Your other ${zones.length - 1} zone${zones.length - 1 !== 1 ? "s are" : " is"} saved but silent. `
                      : zones.length === 0
                        ? "Add a watch zone and we'll start watching it. "
                        : ""}
                    Text and email alerts, and more zones, come with a subscription.
                  </>
                ) : (
                  <>
                    Your subscription ended, so text and email alerts stopped. You still get
                    push alerts on 1 watch zone, and nothing has been deleted —{" "}
                    {zones.length > 0
                      ? `your ${zones.length} watch zone${zones.length !== 1 ? "s are" : " is"} saved and `
                      : "your account and history are intact and "}
                    everything resumes the moment you renew.
                  </>
                )}
              </Text>
              {/*
                Owner ruling 2026-09-14: Stripe, not in-app purchase, for the US
                launch. Both stores now let US apps link out to external payment
                (Apple's commission on those sales is still being litigated;
                Google's US external-links program reports fees from 2026-10-01).
              */}
              <Text
                style={styles.pausedLink}
                onPress={startCheckout}
              >
                {checkoutPending
                  ? "Opening checkout…"
                  : plan.neverSubscribed ? "Subscribe →" : "Renew my subscription →"}
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
              <Text style={styles.pausedLink} onPress={startCheckout}>
                Renew my subscription →
              </Text>
            </View>
          </View>
        )}

        <View style={styles.statsRow}>
          <IosStatCard label="Status" value={<Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>} />
          <IosStatCard label="Zones" value={String(zones.length)} />
          <IosStatCard label="Alerts" value={alertCount} />
        </View>

        {zones.length > 0 && (
          <IosCard style={styles.activityCard}>
            <View style={styles.activityHeaderRow}>
              <Text style={styles.activityTitle}>
                {/* Every account is watched now; only the channels differ. */}
                👀 TattleTow is watching
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
                  gradient={zoneColor(zone.color).gradient}
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
              // Navigate directly: wrapping the row in <Link asChild> replaced its
              // row style, so the icon, label and chevron stacked vertically.
              <IosTableRow onPress={() => router.push("/tabs/alerts")} last>
                <IosIconCell gradient={gradients.iconPurple}>
                  <AlertCircle size={16} color="#fff" />
                </IosIconCell>
                <IosTableRowLabel>View All Alerts</IosTableRowLabel>
                <ChevronRight size={16} color={colors.silver} />
              </IosTableRow>
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
