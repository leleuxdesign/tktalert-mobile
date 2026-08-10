import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CreditCard, MapPin, ChevronRight, Gift } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily, cardShadow } from "@/lib/ios6-theme";
import { formatPhoneDisplay } from "@/lib/format";
import {
  IosPage,
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
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
                  : user.subscriptionStatus === "trial"
                  ? "Free Trial"
                  : "Lapsed"}
              </Text>
            </View>
            <View style={styles.wideCardTrailing}>
              <IosBadge
                gradient={
                  user.subscriptionStatus === "active" || user.subscriptionStatus === "comped"
                    ? gradients.badgeGreen
                    : user.subscriptionStatus === "trial"
                    ? gradients.badgeOrange
                    : gradients.badgeRed
                }
              >
                {user.subscriptionStatus}
              </IosBadge>
            </View>
          </View>
        </View>

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
          </View>
        </View>
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
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
