import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CreditCard, MapPin, ChevronRight, Gift, Shield } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily, cardShadow } from "@/lib/ios6-theme";
import { formatPhoneDisplay } from "@/lib/format";
import {
  IosPage,
  IosKeyboardScroll,
  IosNavBar,
  IosSectionLabel,
  IosIconCell,
  IosBadge,
  IosLockedField,
  IosShadowField,
  IosButton,
} from "@/components/ios6";

interface User {
  id: number;
  email: string;
  role: string;
  phone?: string | null;
  subscriptionStatus: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [cachedUser, setCachedUser] = useState<User | null>(null);

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
  const utils = trpc.useUtils();
  const zonesQuery = trpc.zones.list.useQuery(undefined, { enabled: !!user });

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => meQuery.refetch(),
    onError: (err: any) => Alert.alert("Error", err.message || "Could not update profile."),
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("auth_user");
          logoutMutation.mutate(undefined, {
            onSettled: () => {
              utils.auth.me.invalidate();
              router.replace("/auth/login");
            },
          });
        },
      },
    ]);
  };

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();

  /**
   * Two-step destructive confirm. Google Play and the App Store both require
   * in-app account deletion; the second prompt spells out what is lost, because
   * this is irreversible and cancels any active subscription.
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account, watch zones, and alert history. " +
        "Any active subscription is cancelled. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert("Are you sure?", "There is no way to recover this account.", [
              { text: "Keep My Account", style: "cancel" },
              {
                text: "Delete Forever",
                style: "destructive",
                onPress: () => {
                  deleteAccountMutation.mutate(
                    { confirm: "DELETE" },
                    {
                      onSuccess: async () => {
                        await AsyncStorage.removeItem("auth_user");
                        await utils.auth.me.invalidate();
                        router.replace("/auth/login");
                      },
                      onError: (err: any) =>
                        Alert.alert("Error", err.message || "Could not delete your account."),
                    }
                  );
                },
              },
            ]);
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <IosPage style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </IosPage>
    );
  }

  const zoneCount = zonesQuery.data?.length ?? 0;

  return (
    <IosPage>
      <IosNavBar title="Settings" />
      <IosKeyboardScroll>
        {/* Account */}
        <View style={{ marginBottom: 24 }}>
          <IosSectionLabel>Account</IosSectionLabel>
          <View style={{ gap: 10 }}>
            <IosShadowField>
              <IosLockedField
                label="Email"
                value={user.email ?? ""}
                placeholder="you@example.com"
                keyboardType="email-address"
                saving={updateProfile.isPending}
                onSave={(next) => {
                  if (next && next !== user.email) updateProfile.mutate({ email: next });
                }}
              />
            </IosShadowField>
            <IosShadowField>
              <IosLockedField
                label="Phone (for SMS alerts)"
                value={user.phone ?? ""}
                placeholder="(414) 555-0000"
                keyboardType="phone-pad"
                startEditing={!user.phone}
                saving={updateProfile.isPending}
                formatDisplay={formatPhoneDisplay}
                onSave={(next) => {
                  if (next !== (user.phone ?? "")) updateProfile.mutate({ phone: next || undefined });
                }}
              />
            </IosShadowField>
          </View>
        </View>

        {/* Watch Zones */}
        <View style={{ marginBottom: 24 }}>
          <IosSectionLabel>Watch Zones</IosSectionLabel>
          <Pressable onPress={() => router.push("/watch-zones")}>
            {({ pressed }) => (
              <View style={[styles.wideCard, pressed && { opacity: 0.85 }]}>
                <View style={styles.wideCardIcon}>
                  <IosIconCell gradient={gradients.iconBlue}>
                    <MapPin size={18} color="#fff" />
                  </IosIconCell>
                </View>
                <View style={styles.wideCardBody}>
                  <Text style={styles.wideCardTitle}>Manage Zones</Text>
                  <Text style={styles.wideCardSubtitle}>{zoneCount} of 2 watch zones active</Text>
                </View>
                <View style={styles.wideCardTrailing}>
                  <ChevronRight size={20} color={colors.silver} />
                </View>
              </View>
            )}
          </Pressable>
        </View>

        {/* Subscription */}
        <View style={{ marginBottom: 24 }}>
          <IosSectionLabel>Subscription</IosSectionLabel>
          <View style={styles.wideCard}>
            <View style={styles.wideCardIcon}>
              <IosIconCell gradient={[colors.purple, colors.purpleDark]}>
                <CreditCard size={18} color="#fff" />
              </IosIconCell>
            </View>
            <View style={styles.wideCardBody}>
              <Text style={styles.wideCardTitle}>Current Plan</Text>
              <Text style={styles.wideCardSubtitle}>
                {user.subscriptionStatus === "comped"
                  ? "Comped (Free)"
                  : user.subscriptionStatus === "active"
                  ? "Active Subscription"
                  : "Lapsed"}
              </Text>
            </View>
            <View style={styles.wideCardTrailing}>
              <IosBadge
                gradient={
                  user.subscriptionStatus === "active" || user.subscriptionStatus === "comped"
                    ? gradients.badgeGreen
                    : gradients.badgeRed
                }
              >
                {user.subscriptionStatus}
              </IosBadge>
            </View>
          </View>
        </View>

        {/* Administration */}
        {user.role === "admin" && (
          <View style={{ marginBottom: 24 }}>
            <IosSectionLabel>Administration</IosSectionLabel>
            <Pressable onPress={() => router.push("/admin")}>
              {({ pressed }) => (
                <View style={[styles.wideCard, pressed && { opacity: 0.85 }]}>
                  <View style={styles.wideCardIcon}>
                    <IosIconCell gradient={[colors.purple, colors.purpleDark]}>
                      <Shield size={18} color="#fff" />
                    </IosIconCell>
                  </View>
                  <View style={styles.wideCardBody}>
                    <Text style={styles.wideCardTitle}>Admin</Text>
                    <Text style={styles.wideCardSubtitle}>Users, complaints, alerts & scan log</Text>
                  </View>
                  <View style={styles.wideCardTrailing}>
                    <ChevronRight size={20} color={colors.silver} />
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        )}

        {/* Account Actions */}
        <View>
          <IosSectionLabel>Account Actions</IosSectionLabel>
          <View style={{ gap: 10 }}>
            <View>
              <IosButton variant="silver" disabled onPress={() => {}}>
                <View style={styles.referBtnContent}>
                  <Gift size={16} color={colors.textLight} />
                  <Text style={styles.referBtnText}>Refer a Friend</Text>
                </View>
              </IosButton>
              <Text style={styles.comingSoonText}>
                Coming soon — give a free month, get a free month 🎉
              </Text>
            </View>
            <IosButton variant="red" onPress={handleLogout}>
              Sign Out
            </IosButton>

            <View style={styles.dangerZone}>
              <Text style={styles.dangerLabel}>Delete Account</Text>
              <Text style={styles.dangerBody}>
                Permanently removes your account, watch zones, and alert history, and cancels
                any active subscription. This cannot be undone.
              </Text>
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deleteAccountMutation.isPending}
                hitSlop={6}
              >
                <Text style={styles.dangerAction}>
                  {deleteAccountMutation.isPending ? "Deleting…" : "Delete My Account"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </IosKeyboardScroll>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  dangerZone: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#d8d2c6",
  },
  dangerLabel: { fontSize: 13, fontWeight: "700", color: colors.red, fontFamily, marginBottom: 4 },
  dangerBody: { fontSize: 12, color: colors.textLight, fontFamily, lineHeight: 17, marginBottom: 10 },
  dangerAction: { fontSize: 14, fontWeight: "700", color: colors.red, fontFamily },
  center: { alignItems: "center", justifyContent: "center" },
  referBtnContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  referBtnText: { fontSize: 17, fontWeight: "700", color: colors.textLight, fontFamily },
  comingSoonText: { fontSize: 12, color: colors.textLight, fontFamily, textAlign: "center", marginTop: 6 },
  wideCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    paddingVertical: 18,
    paddingHorizontal: 18,
    ...cardShadow,
  },
  wideCardIcon: { marginRight: 16 },
  wideCardBody: { flex: 1, justifyContent: "center", gap: 3 },
  wideCardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, fontFamily },
  wideCardSubtitle: { fontSize: 13, color: colors.textLight, fontFamily },
  wideCardTrailing: { marginLeft: 16, alignItems: "flex-end", justifyContent: "center" },
});
