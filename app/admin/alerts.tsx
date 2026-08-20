import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { MessageSquare, Mail } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosCard, IosSectionLabel } from "@/components/ios6";

export default function AdminAlertsScreen() {
  const router = useRouter();
  const query = trpc.adminAlerts.list.useQuery({ limit: 100 });
  const data = query.data as any;
  const items = data?.items ?? [];

  return (
    <IosPage>
      <IosNavBar title="Admin · Alerts" onBack={() => router.back()} backLabel="Settings" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <IosSectionLabel>{query.isLoading ? "Loading…" : `${data?.total ?? 0} Alerts Sent`}</IosSectionLabel>

        {query.isLoading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No alerts sent yet.</Text>
          </View>
        ) : (
          <IosCard>
            {items.map((a: any, i: number) => {
              const isSms = a.channel === "sms";
              const iconGradient = a.success
                ? isSms
                  ? gradients.iconGreen
                  : gradients.iconBlue
                : gradients.iconRed;
              return (
                <View key={a.id} style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
                  <View style={[styles.rowIcon, { backgroundColor: (iconGradient as any)[1] }]}>
                    {isSms ? <MessageSquare size={14} color="#fff" /> : <Mail size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {String(a.channel).toUpperCase()} → User #{a.userId}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      Zone #{a.zoneId} · Complaint #{a.complaintId} · {new Date(a.sentAt).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={[styles.rowStatus, { color: a.success ? colors.green : colors.red }]}>
                    {a.success ? "Sent" : "Failed"}
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  rowIcon: { width: 29, height: 29, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.text, fontFamily },
  rowSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 1, fontFamily },
  rowStatus: { fontSize: 11, fontWeight: "700", fontFamily },
});
