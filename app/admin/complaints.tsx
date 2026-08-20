import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { FileText, Lock, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosCard, IosSectionLabel } from "@/components/ios6";

const PAGE_SIZE = 50;

export default function AdminComplaintsScreen() {
  const router = useRouter();
  const [page, setPage] = useState(0);

  const query = trpc.complaints.adminList.useQuery({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const data = query.data as any;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasEncrypted = items.some((c: any) => c.status === "Encrypted");

  return (
    <IosPage>
      <IosNavBar title="Admin · Complaints" onBack={() => router.back()} backLabel="Settings" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.headerRow}>
          <IosSectionLabel>{query.isLoading ? "Loading…" : `${total} Complaints Scanned`}</IosSectionLabel>
          <Pressable onPress={() => query.refetch()} disabled={query.isFetching} hitSlop={8} style={styles.refreshBtn}>
            <RefreshCw size={13} color={colors.blue} />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {hasEncrypted && (
          <View style={styles.aesBanner}>
            <Lock size={15} color={colors.orange} style={{ marginTop: 1 }} />
            <Text style={styles.aesText}>
              <Text style={{ fontWeight: "700" }}>AES key needed. </Text>
              Complaints are being found and stored, but address data is encrypted.
            </Text>
          </View>
        )}

        {query.isLoading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No complaints scanned yet. The scanner runs every 5 minutes.</Text>
          </View>
        ) : (
          <IosCard>
            {items.map((c: any, i: number) => {
              const isEncrypted = c.status === "Encrypted";
              return (
                <View key={c.id} style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: isEncrypted ? colors.orange : colors.green },
                    ]}
                  >
                    {isEncrypted ? <Lock size={12} color="#fff" /> : <FileText size={12} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowId}>{c.externalId}</Text>
                    <Text style={styles.rowAddress} numberOfLines={1}>
                      {isEncrypted
                        ? "Encrypted — key needed"
                        : c.address || `${c.houseNumber ?? ""} ${c.street ?? ""}`.trim() || "—"}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {isEncrypted ? c.status : c.complaintType || "Parking"} · Scanned{" "}
                      {c.scannedAt ? new Date(c.scannedAt).toLocaleString() : "—"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </IosCard>
        )}

        {totalPages > 1 && (
          <View style={styles.pagination}>
            <Pressable
              onPress={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={styles.pageBtn}
              hitSlop={8}
            >
              <ChevronLeft size={15} color={page === 0 ? colors.silver : colors.blue} />
              <Text style={[styles.pageBtnText, page === 0 && { color: colors.silver }]}>Prev</Text>
            </Pressable>
            <Text style={styles.pageLabel}>
              Page {page + 1} of {totalPages}
            </Text>
            <Pressable
              onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={styles.pageBtn}
              hitSlop={8}
            >
              <Text style={[styles.pageBtnText, page >= totalPages - 1 && { color: colors.silver }]}>Next</Text>
              <ChevronRight size={15} color={page >= totalPages - 1 ? colors.silver : colors.blue} />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 6 },
  refreshText: { fontSize: 12, fontWeight: "600", color: colors.blue, fontFamily },
  aesBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255,149,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,149,0,0.3)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  aesText: { flex: 1, fontSize: 12, color: "#7a5200", lineHeight: 17, fontFamily },
  emptyBox: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: colors.textLight, fontFamily, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  rowIcon: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  rowId: { fontSize: 12, fontWeight: "700", color: colors.text, fontFamily },
  rowAddress: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 1, fontFamily },
  rowMeta: { fontSize: 11, color: colors.textLight, marginTop: 1, fontFamily },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 16 },
  pageBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 8 },
  pageBtnText: { fontSize: 13, fontWeight: "600", color: colors.blue, fontFamily },
  pageLabel: { fontSize: 13, color: colors.textLight, fontFamily },
});
