import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import {
  IosPage,
  IosNavBar,
  IosInput,
  IosTable,
  IosTableRow,
  IosBadge,
  IosChevron,
  IosButton,
  IosSectionLabel,
} from "@/components/ios6";

function statusGradient(status: string) {
  if (status === "active" || status === "comped") return gradients.badgeGreen;
  return gradients.badgeRed;
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const usersQuery = trpc.adminUsers.list.useQuery({ search: search.trim() || undefined });

  const users = usersQuery.data ?? [];

  return (
    <IosPage>
      <IosNavBar title="Admin · Users" onBack={() => router.back()} backLabel="Settings" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ marginBottom: 16 }}>
          <IosInput
            placeholder="Search by name, email, or username"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <IosButton variant="blue" onPress={() => router.push("/admin/users/new")}>
            + Add User
          </IosButton>
        </View>

        <IosSectionLabel>
          {users.length} User{users.length === 1 ? "" : "s"}
        </IosSectionLabel>

        {usersQuery.isLoading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : users.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No users found.</Text>
          </View>
        ) : (
          <IosTable>
            {users.map((u: any, i: number) => (
              <IosTableRow key={u.id} last={i === users.length - 1} onPress={() => router.push(`/admin/users/${u.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {u.name ?? u.username ?? u.email ?? `User #${u.id}`}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {u.email ?? "—"}
                  </Text>
                </View>
                <View style={styles.rowTrailing}>
                  <IosBadge gradient={statusGradient(u.subscriptionStatus)}>{u.subscriptionStatus}</IosBadge>
                  <IosChevron />
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
  emptyBox: { alignItems: "center", paddingVertical: 28 },
  emptyText: { fontSize: 14, color: colors.textLight, fontFamily },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text, fontFamily },
  rowSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 1, fontFamily },
  rowTrailing: { flexDirection: "row", alignItems: "center", gap: 8 },
});
