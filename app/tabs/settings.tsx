import { useState, useEffect } from "react";
import { describeSubscription } from "../../lib/subscription";
import { alertAvailability } from "@/lib/alertAccess";
import { useCheckout } from "@/lib/useCheckout";
import { View, Text, ScrollView, Pressable, Switch, Alert, ActivityIndicator, StyleSheet, TextInput, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { CreditCard, ExternalLink, MapPin, MessageSquare, ChevronRight, Shield, Mail, Lock } from "lucide-react-native";
import Constants from "expo-constants";
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
  /** Non-null = express consent to SMS on file. The one thing every SMS send is gated on. */
  smsConsentAt?: string | null;
  /** ALERT emails only — account mail ignores this. Absent/null reads as on. */
  emailAlertsEnabled?: boolean | null;
  isComped?: boolean | null;
  subscriptionStatus: string;
}

/** The public program-details page the A2P campaign points at. */
const SMS_PROGRAM_URL = "https://app.tattletow.com/sms-alerts";

/** Sent with feedback so a report carries its own build context. */
const APP_VERSION = String(Constants.expoConfig?.version ?? "unknown");

export default function SettingsScreen() {
  const router = useRouter();
  /*
    `focus=phone` arrives from the post-subscribe text-alerts prompt, so the
    person lands on the field they were sent here to fill in rather than having
    to find it. `t` is a nonce from the caller: this tab stays mounted, and
    IosLockedField only reads `startEditing` on mount, so the key has to change
    for the editor to re-open on a second arrival.
  */
  const { focus, t: focusNonce } = useLocalSearchParams<{ focus?: string; t?: string }>();
  const focusPhone = focus === "phone";
  const [cachedUser, setCachedUser] = useState<User | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackBody, setFeedbackBody] = useState("");

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

  const accessQuery = trpc.map.access.useQuery();

  const { startCheckout, isPending: checkoutPending } = useCheckout();
  const user: User | null = meQuery.data ?? cachedUser;
  const utils = trpc.useUtils();
  const zonesQuery = trpc.zones.list.useQuery(undefined, { enabled: !!user });

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => meQuery.refetch(),
    onError: (err: any) => Alert.alert("Error", err.message || "Could not update profile."),
  });

  /**
   * Text alerts (A2P 10DLC / TCPA). The signup opt-in is the record of consent;
   * this switch is the record of withdrawal. Turning it off writes NULL to
   * `smsConsentAt`, which is the single flag every server-side SMS send is
   * gated on — so this switch is the whole story, and email and push are
   * unaffected either way.
   *
   * `scope: "sms"` matters: without it the server would also re-stamp
   * `consentGivenAt`, overwriting the date the user acknowledged the service
   * disclaimer at signup.
   */
  const setEmailAlerts = trpc.auth.setEmailAlerts.useMutation({
    onSuccess: () => meQuery.refetch(),
    onError: (e: any) => Alert.alert("Couldn't save", e.message),
  });

  const submitFeedback = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      setFeedbackBody("");
      setFeedbackOpen(false);
      Alert.alert("Sent", "Thank you — we read every one of these.");
    },
    onError: (e: any) => Alert.alert("Couldn't send", e.message),
  });

  const recordConsent = trpc.auth.recordConsent.useMutation({
    onSuccess: () => meQuery.refetch(),
    onError: (err: any) =>
      Alert.alert("Error", err?.message || "Could not update your text-alert preference."),
  });

  const handleSmsToggle = (next: boolean) => {
    // Consent to text a number we do not have is not consent to anything. The
    // server refuses this too; catching it here gives a better message.
    if (next && !user?.phone?.trim()) {
      Alert.alert(
        "Add a mobile number",
        "Add your mobile number above before turning text alerts on."
      );
      return;
    }
    recordConsent.mutate({ smsConsent: next, scope: "sms" });
  };

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

  /**
   * BL-7: self-serve subscription management. The server creates a Stripe
   * billing-portal session (hosted by Stripe — cancel/card-update happen
   * there), and we hand the URL to the external browser. No purchase UI
   * lives in the app; this only links out, matching the v1.0 login-only
   * billing pattern.
   */
  const billingPortalMutation = trpc.stripe.createBillingPortalSession.useMutation({
    onSuccess: async (data) => {
      const url = data?.url;
      if (!url) {
        Alert.alert(
          "Something went wrong",
          "We couldn't open your subscription settings. Please try again, or manage your subscription at tattletow.com."
        );
        return;
      }
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(
          "Couldn't open browser",
          "Please visit tattletow.com to manage your subscription."
        );
      }
    },
    onError: () => {
      Alert.alert(
        "Something went wrong",
        "We couldn't open your subscription settings. Please try again, or manage your subscription at tattletow.com."
      );
    },
  });

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
  const plan = describeSubscription(user);
  /*
    Owner ruling 2026-09-18: free accounts get push alerts on one zone; text and
    email alerts are paid. An unavailable channel is shown as unavailable WITH
    the reason — never as a switch turned off — and its stored value (including
    SMS consent) is left untouched so it resumes on subscribe.
  */
  const alerts = alertAvailability(accessQuery.data);
  const supportThread = trpc.support.myThread.useQuery(undefined, { refetchInterval: 60_000 });
  const supportUnread = (supportThread.data as any)?.unread ?? 0;

  // Stripe-billed users only (active or lapsed). Comped accounts have no
  // Stripe customer, so a billing-portal session cannot be created for them.
  const hasStripeSubscription =
    user.subscriptionStatus === "active" || user.subscriptionStatus === "lapsed";

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
                key={`phone-${focusPhone ? (focusNonce ?? "focus") : "idle"}`}
                label="Phone (for SMS alerts)"
                value={user.phone ?? ""}
                placeholder="(414) 555-0000"
                keyboardType="phone-pad"
                startEditing={!user.phone || focusPhone}
                saving={updateProfile.isPending}
                formatDisplay={formatPhoneDisplay}
                onSave={(next) => {
                  if (next !== (user.phone ?? "")) updateProfile.mutate({ phone: next || undefined });
                }}
              />
            </IosShadowField>
          </View>
        </View>

        {/* Text Alerts (SMS consent) */}
        <View style={{ marginBottom: 24 }}>
          <IosSectionLabel>Text Alerts</IosSectionLabel>
          <View style={styles.wideCardColumn}>
            <View style={styles.smsHeaderRow}>
              <View style={styles.wideCardIcon}>
                <IosIconCell gradient={gradients.iconGreen}>
                  <MessageSquare size={18} color="#fff" />
                </IosIconCell>
              </View>
              <View style={styles.wideCardBody}>
                <Text style={styles.wideCardTitle}>Text me parking-complaint alerts</Text>
                <Text style={styles.wideCardSubtitle}>
                  {!alerts.sms
                    ? alerts.unavailableReason
                    : user.smsConsentAt
                      ? `Opted in ${new Date(user.smsConsentAt).toLocaleString()}${
                          user.phone ? ` · ${formatPhoneDisplay(user.phone)}` : ""
                        }`
                      : `Off — you'll still get push alerts.${
                          user.phone ? "" : " Add a phone number above to turn this on."
                        }`}
                </Text>
              </View>
              <View style={styles.wideCardTrailing}>
                {!alerts.sms ? (
                  // Unavailable, not off: the stored consent is left exactly as
                  // it is and this switch never fires a mutation.
                  <Lock size={18} color={colors.textFaint} />
                ) : recordConsent.isPending ? (
                  <ActivityIndicator color={colors.blue} />
                ) : (
                  <Switch
                    value={!!user.smsConsentAt}
                    onValueChange={handleSmsToggle}
                    trackColor={{ false: "#78788033", true: colors.green }}
                  />
                )}
              </View>
            </View>
            <Text style={styles.smsDisclosure}>
              Message frequency varies — typically 0–5 messages per week. Message and data rates may
              apply. Reply STOP to unsubscribe, HELP for help. Text alerts are optional and are
              never required to use TattleTow.
            </Text>
            <Text
              style={styles.smsLink}
              onPress={() => Linking.openURL(SMS_PROGRAM_URL).catch(() => {})}
            >
              About TattleTow text alerts
            </Text>
          </View>
        </View>

        {/* Email Alerts — ALERTS ONLY.
            Turning this off must never touch account mail. Password resets,
            receipts and dunning go through a different server path that does
            not read this flag, and the copy says so, because a user who mutes
            alert volume still has to be able to get back into their account. */}
        <View style={{ marginBottom: 24 }}>
          <IosSectionLabel>Email Alerts</IosSectionLabel>
          <View style={styles.wideCardColumn}>
            <View style={styles.smsHeaderRow}>
              <View style={styles.wideCardIcon}>
                <IosIconCell gradient={gradients.iconBlue}>
                  <Mail size={18} color="#fff" />
                </IosIconCell>
              </View>
              <View style={styles.wideCardBody}>
                <Text style={styles.wideCardTitle}>Email me parking-complaint alerts</Text>
                <Text style={styles.wideCardSubtitle}>
                  {!alerts.email
                    ? alerts.unavailableReason
                    : user.emailAlertsEnabled === false
                      ? "Off — you'll still get push alerts."
                      : `On — sent to ${user.email}`}
                </Text>
              </View>
              <View style={styles.wideCardTrailing}>
                {!alerts.email ? (
                  // Unavailable, not off: emailAlertsEnabled is left untouched.
                  <Lock size={18} color={colors.textFaint} />
                ) : setEmailAlerts.isPending ? (
                  <ActivityIndicator color={colors.blue} />
                ) : (
                  <Switch
                    value={user.emailAlertsEnabled !== false}
                    onValueChange={(v) => setEmailAlerts.mutate({ enabled: v })}
                    trackColor={{ false: "#78788033", true: colors.green }}
                  />
                )}
              </View>
            </View>
            <Text style={styles.smsDisclosure}>
              This turns off alert emails only. You'll still receive account email — password
              resets, receipts and billing notices — because those keep your account working.
            </Text>
          </View>
        </View>

        {/* No-channel warning. A paying user with text and email off and push
            denied receives nothing at all while being charged, concludes the
            product is broken, and is right. Warn rather than block — they may
            be part-way through setting things up. */}
        {alerts.email && alerts.sms && !user.smsConsentAt && user.emailAlertsEnabled === false && (
          <View style={[styles.wideCardColumn, { marginBottom: 24, borderLeftWidth: 4, borderLeftColor: colors.orange }]}>
            <Text style={[styles.wideCardTitle, { color: colors.orange }]}>
              You have no way to receive alerts
            </Text>
            <Text style={styles.smsDisclosure}>
              Text and email alerts are both off. Push notifications are the only channel left —
              if those are denied in your phone's settings, nothing will reach you.
            </Text>
          </View>
        )}

        {/* Support — one-to-one with the Owner. Placed above Feedback because a
            conversation is the better channel when someone has a problem; the
            one-way form remains for people who just want to leave an idea. */}
        <View style={{ marginBottom: 24 }}>
          <IosSectionLabel>Support</IosSectionLabel>
          <View style={styles.wideCardColumn}>
            <Pressable onPress={() => router.push("/support")}>
              {({ pressed }) => (
                <View style={[styles.smsHeaderRow, pressed && { opacity: 0.85 }]}>
                  <View style={styles.wideCardIcon}>
                    <IosIconCell gradient={gradients.iconBlue}>
                      <MessageSquare size={18} color="#fff" />
                    </IosIconCell>
                  </View>
                  <View style={styles.wideCardBody}>
                    <Text style={styles.wideCardTitle}>Message us</Text>
                    <Text style={styles.wideCardSubtitle}>
                      {supportUnread > 0
                        ? `${supportUnread} new repl${supportUnread === 1 ? "y" : "ies"}`
                        : "Talk directly to the person who builds TattleTow."}
                    </Text>
                  </View>
                  <View style={styles.wideCardTrailing}>
                    {supportUnread > 0 && (
                      <View style={styles.unreadDot}>
                        <Text style={styles.unreadDotText}>{supportUnread}</Text>
                      </View>
                    )}
                    <ChevronRight size={20} color={colors.silver} />
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Feedback — the medium that makes a comped tester's access
            conditional rather than a gift. One-way for now; the v1.5 support
            chat supersedes it and can adopt these rows. */}
        <View style={{ marginBottom: 24 }}>
          <IosSectionLabel>Quick Feedback</IosSectionLabel>
          <View style={styles.wideCardColumn}>
            {!feedbackOpen ? (
              <Pressable onPress={() => setFeedbackOpen(true)}>
                {({ pressed }) => (
                  <View style={[styles.smsHeaderRow, pressed && { opacity: 0.85 }]}>
                    <View style={styles.wideCardIcon}>
                      <IosIconCell gradient={gradients.iconPurple}>
                        <MessageSquare size={18} color="#fff" />
                      </IosIconCell>
                    </View>
                    <View style={styles.wideCardBody}>
                      <Text style={styles.wideCardTitle}>Send feedback (one-way)</Text>
                      <Text style={styles.wideCardSubtitle}>
                        {user.isComped
                          ? "Drop a note without starting a conversation. For a reply, use Message us above."
                          : "Drop a note without starting a conversation. For a reply, use Message us above."}
                      </Text>
                    </View>
                    <View style={styles.wideCardTrailing}>
                      <ChevronRight size={20} color={colors.silver} />
                    </View>
                  </View>
                )}
              </Pressable>
            ) : (
              <View style={{ gap: 10 }}>
                <TextInput
                  style={styles.feedbackInput}
                  multiline
                  numberOfLines={5}
                  placeholder="What happened, or what would you like to see?"
                  placeholderTextColor={colors.textLight}
                  value={feedbackBody}
                  onChangeText={setFeedbackBody}
                  textAlignVertical="top"
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <IosButton
                    variant="silver"
                    flex={1}
                    onPress={() => {
                      setFeedbackOpen(false);
                      setFeedbackBody("");
                    }}
                  >
                    Cancel
                  </IosButton>
                  <IosButton
                    variant="blue"
                    flex={2}
                    loading={submitFeedback.isPending}
                    onPress={() =>
                      submitFeedback.mutate({
                        kind: "general",
                        body: feedbackBody.trim(),
                        platform: Platform.OS,
                        appVersion: APP_VERSION,
                      })
                    }
                  >
                    Send
                  </IosButton>
                </View>
              </View>
            )}
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
                  <Text style={styles.wideCardSubtitle}>
                    {zoneCount === 1 ? "1 watch zone active" : `${zoneCount} watch zones active`}
                  </Text>
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
          <View style={{ gap: 10 }}>
            <View style={styles.wideCard}>
              <View style={styles.wideCardIcon}>
                <IosIconCell gradient={[colors.purple, colors.purpleDark]}>
                  <CreditCard size={18} color="#fff" />
                </IosIconCell>
              </View>
              <View style={styles.wideCardBody}>
                <Text style={styles.wideCardTitle}>Current Plan</Text>
                <Text style={styles.wideCardSubtitle}>
                  {plan.entitled ? plan.planLabel : `${plan.planLabel} · push alerts on 1 zone`}
                </Text>
                {!plan.entitled && (
                  <Text style={styles.subscribeLink} onPress={startCheckout}>
                    {checkoutPending
                      ? "Opening checkout…"
                      : "Subscribe to get text and email alerts and more zones →"}
                  </Text>
                )}
              </View>
              <View style={styles.wideCardTrailing}>
                {/*
                  Never render `subscriptionStatus` directly. It is a database
                  enum, it has contained values the UI does not honour (the
                  retired "trial"), and it disagreed with the label beside it.
                */}
                <IosBadge
                  gradient={plan.entitled ? gradients.badgeGreen : gradients.badgeRed}
                >
                  {plan.badge}
                </IosBadge>
              </View>
            </View>
            {hasStripeSubscription && (
              <Pressable
                onPress={() =>
                  billingPortalMutation.mutate({
                    // Stripe returns here, which points the customer back to the app.
                    returnUrl: "https://app.tattletow.com/subscribed?source=app&portal=1",
                  })
                }
                disabled={billingPortalMutation.isPending}
              >
                {({ pressed }) => (
                  <View style={[styles.wideCard, pressed && { opacity: 0.85 }]}>
                    <View style={styles.wideCardIcon}>
                      <IosIconCell gradient={gradients.iconBlue}>
                        <ExternalLink size={18} color="#fff" />
                      </IosIconCell>
                    </View>
                    <View style={styles.wideCardBody}>
                      <Text style={styles.wideCardTitle}>Manage Subscription</Text>
                      <Text style={styles.wideCardSubtitle}>
                        {billingPortalMutation.isPending
                          ? "Opening…"
                          : "Cancel or update billing in your browser"}
                      </Text>
                    </View>
                    <View style={styles.wideCardTrailing}>
                      {billingPortalMutation.isPending ? (
                        <ActivityIndicator color={colors.blue} />
                      ) : (
                        <ChevronRight size={20} color={colors.silver} />
                      )}
                    </View>
                  </View>
                )}
              </Pressable>
            )}
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
  wideCardColumn: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.separator,
    paddingVertical: 18,
    paddingHorizontal: 18,
    ...cardShadow,
  },
  smsHeaderRow: { flexDirection: "row", alignItems: "center" },
  smsDisclosure: { fontSize: 12, color: colors.textLight, fontFamily, lineHeight: 18, marginTop: 10 },
  subscribeLink: { fontSize: 13, fontWeight: "700", color: colors.blue, fontFamily, marginTop: 6 },
  smsLink: { fontSize: 12, color: colors.blue, fontFamily, marginTop: 8 },
  wideCardIcon: { marginRight: 16 },
  wideCardBody: { flex: 1, justifyContent: "center", gap: 3 },
  wideCardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, fontFamily },
  wideCardSubtitle: { fontSize: 13, color: colors.textLight, fontFamily },
  feedbackInput: {
    minHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.18)",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
    fontSize: 15,
    color: colors.text,
    fontFamily,
  },
  unreadDot: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.red,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 5, marginRight: 6,
  },
  unreadDotText: { color: "#fff", fontSize: 11, fontWeight: "700", fontFamily },
  wideCardTrailing: { marginLeft: 16, alignItems: "flex-end", justifyContent: "center" },
});
