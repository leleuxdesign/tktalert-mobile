import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { Bell, CheckCircle2, XCircle } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosTable, IosTableRow, IosIconCell, IosBadge, IosCard } from "@/components/ios6";

const AVERAGE_TICKET_VALUE = 35;

export default function AlertsScreen() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const { data: alerts, isLoading } = trpc.alerts.myAlerts.useQuery({ limit: 100 }, { enabled: !!user });
  const markRead = trpc.alerts.markRead.useMutation({
    onSuccess: () => utils.alerts.myAlerts.invalidate(),
  });

  const totalAlerts = alerts?.length ?? 0;
  const estimatedSavings = totalAlerts * AVERAGE_TICKET_VALUE;

  return (
    <IosPage>
      <IosNavBar title="Alert History" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {totalAlerts > 0 && (
          <IosCard style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statsItem}>
                <Text style={styles.statsValue}>{totalAlerts}</Text>
                <Text style={styles.statsLabel}>Alerts Received</Text>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsItem}>
                <Text style={[styles.statsValue, { color: colors.green }]}>${estimatedSavings}</Text>
                <Text style={styles.statsLabel}>Est. Saved</Text>
              </View>
            </View>
            <Text style={styles.statsFootnote}>Estimated at ${AVERAGE_TICKET_VALUE}/avoided ticket</Text>
          </IosCard>
        )}

        <View style={styles.header}>
          <Text style={styles.headerLabel}>Alert History</Text>
          <IosBadge gradient={["#6d6d72", "#6d6d72"]}>{String(alerts?.length ?? 0)}</IosBadge>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 40 }} />
        ) : !alerts || alerts.length === 0 ? (
          <IosTable>
            <View style={styles.emptyBox}>
              <Bell size={36} color={colors.silver} />
              <Text style={styles.emptyTitle}>No Alerts Yet</Text>
              <Text style={styles.emptySubtitle}>
                You'll be notified when a complaint is filed near your watch zone.
              </Text>
            </View>
          </IosTable>
        ) : (
          <IosTable>
            {alerts.map((alert: any, i: number) => (
              <IosTableRow
                key={alert.id}
                last={i === alerts.length - 1}
                style={alert.readAt ? { opacity: 0.55 } : undefined}
              >
                <IosIconCell gradient={alert.success ? gradients.iconRed : gradients.iconGray}>
                  <Bell size={16} color="#fff" />
                </IosIconCell>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Alert via {String(alert.channel).toUpperCase()}</Text>
                  <Text style={styles.rowSubtitle}>
                    Complaint #{alert.complaintId} · Zone #{alert.zoneId}
                  </Text>
                  <Text style={styles.rowTimestamp}>{new Date(alert.sentAt).toLocaleString()}</Text>
                </View>
                <View style={styles.rowTrailing}>
                  {alert.success ? (
                    <CheckCircle2 size={18} color={colors.green} />
                  ) : (
                    <XCircle size={18} color={colors.red} />
                  )}
                  {alert.readAt ? (
                    <Text style={styles.clearedLabel}>Cleared</Text>
                  ) : (
                    <Pressable onPress={() => markRead.mutate({ alertId: alert.id })} hitSlop={6}>
                      <Text style={styles.markReadLink}>Mark Read</Text>
                    </Pressable>
                  )}
                </View>
              </IosTableRow>
            ))}
          </IosTable>
        )}
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  statsCard: { padding: 14, marginBottom: 20 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statsItem: { flex: 1, alignItems: "center" },
  statsDivider: { width: 1, height: 30, backgroundColor: colors.separator },
  statsValue: { fontSize: 22, fontWeight: "700", color: colors.blue, fontFamily },
  statsLabel: { fontSize: 11, color: colors.textLight, fontFamily, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  statsFootnote: { fontSize: 11, color: colors.textFaint, fontFamily, textAlign: "center", marginTop: 10 },
  rowTrailing: { alignItems: "flex-end", gap: 6 },
  clearedLabel: { fontSize: 11, fontWeight: "700", color: colors.textFaint, fontFamily },
  markReadLink: { fontSize: 11, fontWeight: "700", color: colors.blue, fontFamily },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerLabel: { fontSize: 13, fontWeight: "700", color: colors.textLight, letterSpacing: 0.5, textTransform: "uppercase", fontFamily },
  emptyBox: { alignItems: "center", paddingVertical: 28, gap: 6, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, fontFamily },
  emptySubtitle: { fontSize: 13, color: colors.textLight, textAlign: "center", fontFamily },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.text, fontFamily },
  rowSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 1, fontFamily },
  rowTimestamp: { fontSize: 11, color: colors.textFaint, marginTop: 1, fontFamily },
});
