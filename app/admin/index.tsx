import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Users, Activity, Bell, FileText, Play } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosCard, IosButton, IosSectionLabel } from "@/components/ios6";

function scanStatusGradient(status: string) {
  if (status === "success") return gradients.badgeGreen;
  if (status === "error") return gradients.badgeRed;
  return gradients.badgeOrange;
}

export default function AdminOverviewScreen() {
  const router = useRouter();
  const statsQuery = trpc.adminStats.overview.useQuery();
  const stats = statsQuery.data as any;

  const triggerScan = trpc.scanner.trigger.useMutation({
    onSuccess: (result: any) => {
      Alert.alert("Scan Complete", `${result.complaintsFound} complaints found, ${result.alertsSent} alerts sent.`);
      statsQuery.refetch();
    },
    onError: (err: any) => Alert.alert("Scan Failed", err.message || "Could not run scanner."),
  });

  const statItems = [
    { label: "Total Users", value: stats?.userStats?.total ?? "—", icon: Users, gradient: gradients.iconBlue },
    { label: "Active Subs", value: stats?.userStats?.active ?? "—", icon: Activity, gradient: gradients.iconGreen },
    { label: "Complaints", value: stats?.complaintsTotal ?? "—", icon: FileText, gradient: gradients.iconOrange },
    { label: "Alerts Sent", value: stats?.alertsTotal ?? "—", icon: Bell, gradient: gradients.iconRed },
  ];

  const recentScans = stats?.recentScans ?? [];

  return (
    <IosPage>
      <IosNavBar title="Admin · Overview" onBack={() => router.back()} backLabel="Settings" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.statGrid}>
          {statItems.map((s) => (
            <IosCard key={s.label} style={styles.statCard}>
              <View style={styles.statHeader}>
                <View style={[styles.statIcon, { backgroundColor: (s.gradient as any)[1] }]}>
                  <s.icon size={16} color="#fff" />
                </View>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              <Text style={styles.statValue}>{String(s.value)}</Text>
            </IosCard>
          ))}
        </View>

        <IosSectionLabel>Scanner Control</IosSectionLabel>
        <IosCard style={{ padding: 16, marginBottom: 20 }}>
          <View style={styles.scannerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scannerLabel}>Last Scanned</Text>
              <Text style={styles.scannerValue}>
                {stats?.scannerState?.lastScannedAt
                  ? new Date(stats.scannerState.lastScannedAt).toLocaleString()
                  : "Never"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scannerLabel}>Last Complaint ID</Text>
              <Text style={styles.scannerValue}>{stats?.scannerState?.lastComplaintId ?? "—"}</Text>
            </View>
          </View>
          <IosButton variant="blue" onPress={() => triggerScan.mutate()} loading={triggerScan.isPending}>
            <View style={styles.scanBtnContent}>
              <Play size={14} color="#fff" />
              <Text style={styles.scanBtnText}>Run Manual Scan</Text>
            </View>
          </IosButton>
        </IosCard>

        <IosSectionLabel>Recent Scans</IosSectionLabel>
        <IosCard>
          {recentScans.length === 0 ? (
            <View style={styles.scanRow}>
              <Text style={styles.emptyText}>No scans yet.</Text>
            </View>
          ) : (
            recentScans.map((scan: any, i: number) => (
              <View key={scan.id} style={[styles.scanRow, i < recentScans.length - 1 && styles.scanRowBorder]}>
                <View style={[styles.scanIcon, { backgroundColor: (scanStatusGradient(scan.status) as any)[1] }]}>
                  <Activity size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scanTitle}>
                    {scan.complaintsFound ?? 0} complaints · {scan.alertsSent ?? 0} alerts
                  </Text>
                  <Text style={styles.scanSubtitle}>
                    {new Date(scan.startedAt).toLocaleString()} · by {scan.triggeredBy}
                  </Text>
                </View>
                <Text style={[styles.scanStatus, { color: (scanStatusGradient(scan.status) as any)[1] }]}>
                  {scan.status}
                </Text>
              </View>
            ))
          )}
        </IosCard>
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontSize: 14, color: colors.textLight, fontFamily },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  statCard: { width: "47%", padding: 14 },
  statHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 10, fontWeight: "700", color: colors.textLight, textTransform: "uppercase", letterSpacing: 0.3, fontFamily, flexShrink: 1 },
  statValue: { fontSize: 26, fontWeight: "800", color: colors.text, fontFamily },
  scannerRow: { flexDirection: "row", gap: 12, marginBottom: 14, flexWrap: "wrap" },
  scannerLabel: { fontSize: 12, color: colors.textLight, marginBottom: 2, fontFamily },
  scannerValue: { fontSize: 14, fontWeight: "600", color: colors.text, fontFamily },
  scanBtnContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  scanBtnText: { fontSize: 17, fontWeight: "700", color: "#fff", fontFamily },
  scanRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  scanRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  scanIcon: { width: 29, height: 29, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  scanTitle: { fontSize: 13, fontWeight: "600", color: colors.text, fontFamily },
  scanSubtitle: { fontSize: 11, color: colors.textLight, marginTop: 1, fontFamily },
  scanStatus: { fontSize: 11, fontWeight: "700", fontFamily },
});
