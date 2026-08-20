import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Activity, Clock, AlertCircle } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosCard, IosSectionLabel } from "@/components/ios6";

function scanIconGradient(status: string) {
  if (status === "success") return gradients.iconGreen;
  if (status === "running") return gradients.iconBlue;
  return gradients.iconRed;
}

export default function AdminScanLogScreen() {
  const router = useRouter();
  const scannerStateQuery = trpc.scanner.state.useQuery();
  const logQuery = trpc.adminScanLog.list.useQuery({ limit: 50 });
  const scannerState = scannerStateQuery.data as any;
  const items = (logQuery.data as any) ?? [];

  return (
    <IosPage>
      <IosNavBar title="Admin · Scan Log" onBack={() => router.back()} backLabel="Settings" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {scannerState && (
          <>
            <IosSectionLabel>Scanner State</IosSectionLabel>
            <View style={styles.stateGrid}>
              <IosCard style={styles.stateCard}>
                <Text style={styles.stateLabel}>Last Scanned</Text>
                <Text style={styles.stateValue}>
                  {scannerState.lastScannedAt ? new Date(scannerState.lastScannedAt).toLocaleString() : "Never"}
                </Text>
              </IosCard>
              <IosCard style={styles.stateCard}>
                <Text style={styles.stateLabel}>Last Complaint ID</Text>
                <Text style={styles.stateValue}>{scannerState.lastComplaintId ?? "—"}</Text>
              </IosCard>
            </View>
          </>
        )}

        <IosSectionLabel>{logQuery.isLoading ? "Loading…" : `${items.length} Recent Scans`}</IosSectionLabel>

        {logQuery.isLoading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No scans recorded yet.</Text>
          </View>
        ) : (
          <IosCard>
            {items.map((scan: any, i: number) => {
              const isSuccess = scan.status === "success";
              const isRunning = scan.status === "running";
              return (
                <View key={scan.id} style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
                  <View style={[styles.rowIcon, { backgroundColor: (scanIconGradient(scan.status) as any)[1] }]}>
                    {isSuccess ? (
                      <Activity size={14} color="#fff" />
                    ) : isRunning ? (
                      <Clock size={14} color="#fff" />
                    ) : (
                      <AlertCircle size={14} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {scan.triggeredBy} · {new Date(scan.startedAt).toLocaleString()}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      {scan.complaintsFound ?? 0} complaints · {scan.alertsSent ?? 0} alerts
                      {scan.completedAt ? ` · finished ${new Date(scan.completedAt).toLocaleTimeString()}` : " · in progress"}
                    </Text>
                    {scan.errorMessage ? <Text style={styles.errorText}>{scan.errorMessage}</Text> : null}
                  </View>
                  <Text style={[styles.rowStatus, { color: (scanIconGradient(scan.status) as any)[1] }]}>
                    {scan.status}
                  </Text>
                </View>
              );
            })}
          </IosCard>
        )}
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  emptyBox: { alignItems: "center", paddingVertical: 28 },
  emptyText: { fontSize: 14, color: colors.textLight, fontFamily },
  stateGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  stateCard: { flex: 1, padding: 12 },
  stateLabel: { fontSize: 11, color: colors.textLight, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3, fontFamily },
  stateValue: { fontSize: 14, fontWeight: "700", color: colors.text, fontFamily },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  rowIcon: { width: 29, height: 29, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.text, fontFamily },
  rowSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 1, fontFamily },
  errorText: { fontSize: 11, color: colors.red, marginTop: 2, fontFamily },
  rowStatus: { fontSize: 11, fontWeight: "700", fontFamily },
});
