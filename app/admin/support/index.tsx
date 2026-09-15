import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import {
  IosPage,
  IosNavBar,
  IosTable,
  IosTableRow,
  IosBadge,
  IosChevron,
  IosSectionLabel,
} from "@/components/ios6";

/**
 * Admin support inbox — who has written in, unread and newest first, then every
 * other account so a conversation can be started with anyone.
 *
 * This screen was missing from the first chat build: the Support tab opened a
 * conversation with no customer attached, so it looked empty even though
 * messages had arrived on the server.
 */
export default function AdminSupportInbox() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const inbox = trpc.adminSupport.inbox.useQuery(undefined, { refetchInterval: 20_000 });

  const rows: any[] = (inbox.data as any[]) ?? [];
  const conversations = rows.filter((r) => r.threadId != null);
  const everyoneElse = rows.filter((r) => r.threadId == null);

  const onRefresh = async () => {
    setRefreshing(true);
    await inbox.refetch();
    setRefreshing(false);
  };

  const renderRow = (r: any, i: number, list: any[]) => {
    const unread = Number(r.unreadForAdmin ?? 0);
    return (
      <IosTableRow
        key={r.userId}
        last={i === list.length - 1}
        onPress={() => router.push(`/admin/support/${r.userId}`)}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, unread > 0 && styles.unreadTitle]} numberOfLines={1}>
            {r.email ?? `User #${r.userId}`}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>{deviceLine(r)}</Text>
          {r.lastMessageAt ? (
            <Text style={styles.rowMeta} numberOfLines={1}>
              Last message {new Date(r.lastMessageAt).toLocaleString()}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowTrailing}>
          {unread > 0 ? (
            <IosBadge gradient={gradients.badgeRed}>{unread > 1 ? String(unread) : "New"}</IosBadge>
          ) : null}
          <IosChevron />
        </View>
      </IosTableRow>
    );
  };

  return (
    <IosPage>
      <IosNavBar title="Support" onBack={() => router.back()} backLabel="Settings" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
      >
        {inbox.isLoading ? (
          <ActivityIndicator color={colors.blue} style={{ marginTop: 24 }} />
        ) : (
          <>
            <IosSectionLabel>
              {conversations.length} Conversation{conversations.length === 1 ? "" : "s"}
            </IosSectionLabel>
            {conversations.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  No messages yet. When a customer writes in from Settings → Support, it shows up here.
                </Text>
              </View>
            ) : (
              <View style={{ marginBottom: 20 }}>
                <IosTable>{conversations.map((r, i) => renderRow(r, i, conversations))}</IosTable>
              </View>
            )}

            {everyoneElse.length > 0 && (
              <>
                <IosSectionLabel>Start a conversation</IosSectionLabel>
                <IosTable>{everyoneElse.map((r, i) => renderRow(r, i, everyoneElse))}</IosTable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </IosPage>
  );
}

/** One line of device context so a "my alerts stopped" message can be read at a glance. */
function deviceLine(r: any): string {
  const platform =
    r.platform === "ios" ? "iOS" : r.platform === "android" ? "Android" : r.platform ?? null;
  const parts = [
    platform ? `${platform} ${r.osVersion ?? ""}`.trim() : null,
    r.deviceModel ?? null,
    r.appVersion ? `app ${r.appVersion}` : null,
    r.pushPermission ? `push ${r.pushPermission}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No device info yet";
}

const styles = StyleSheet.create({
  emptyBox: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 12, marginBottom: 12 },
  emptyText: { fontSize: 13, color: colors.textLight, fontFamily, textAlign: "center", lineHeight: 19 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text, fontFamily },
  unreadTitle: { fontWeight: "800" },
  rowSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 1, fontFamily },
  rowMeta: { fontSize: 11, color: colors.textFaint, marginTop: 1, fontFamily },
  rowTrailing: { flexDirection: "row", alignItems: "center", gap: 8 },
});
