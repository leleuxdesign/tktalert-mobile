import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { colors, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosButton, IosCard } from "@/components/ios6";
import {
  IAP_AVAILABLE,
  STORE_NAME,
  loadOffer,
  purchase,
  restore,
  type PaywallOffer,
} from "@/lib/purchases";

/**
 * Subscription paywall (Owner ruling D-13; Apple Guideline 3.1.2).
 *
 * Shows, before purchase: the subscription's title and length, the price per
 * period, the free trial and what happens when it ends, auto-renewal and how to
 * cancel, Terms of Use and Privacy Policy links, and Restore Purchases.
 *
 * Price and trial come from the store via RevenueCat — never hardcoded. Only
 * reachable from signed-in screens, so every purchase is tied to an account
 * (and its email) through `Purchases.logIn(userId)` in the root layout.
 *
 * PLACEHOLDER COPY: Fran's final strings land in marketing/COPY-IAP-LAUNCH.md;
 * swap them into COPY below.
 */
const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = "https://tattletow.com/privacy";

const COPY = {
  navTitle: "Subscribe",
  title: "TattleTow Alerts",
  subtitle: "Monthly subscription",
  pitch:
    "Push, text and email alerts the moment a parking complaint is filed in your watch zones in Milwaukee.",
  unavailable: "Subscriptions aren't available in the app yet. Please check back soon.",
  billingAccount: Platform.OS === "ios" ? "your Apple Account" : "your Google Play account",
  cancelWhere:
    Platform.OS === "ios"
      ? "your App Store account settings (Settings → your name → Subscriptions)"
      : "Google Play (Profile → Payments & subscriptions → Subscriptions)",
  /** Apple requires cancelling 24 hours ahead; Google Play allows any time before. */
  cancelBefore: Platform.OS === "ios" ? "at least 24 hours before" : "before",
};

export default function PaywallScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [offer, setOffer] = useState<PaywallOffer | null>(null);
  const [loading, setLoading] = useState(IAP_AVAILABLE);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);

  useEffect(() => {
    if (!IAP_AVAILABLE) return;
    let active = true;
    loadOffer()
      .then((o) => active && setOffer(o))
      .catch(() => active && setOffer(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const finishUnlocked = useCallback(
    async (title: string, body: string) => {
      // Server is the source of truth (RevenueCat webhook); refresh it now and
      // rely on the optimistic store entitlement until the webhook lands.
      await utils.auth.me.invalidate();
      Alert.alert(title, body, [{ text: "OK", onPress: () => router.back() }]);
    },
    [utils, router]
  );

  const onBuy = async () => {
    if (!offer) return;
    setBusy("buy");
    try {
      const outcome = await purchase(offer.pkg);
      if (outcome === "success") {
        await finishUnlocked("You're subscribed", "Your alerts are on. Thank you for supporting TattleTow.");
      } else if (outcome === "pending") {
        Alert.alert(
          "Purchase pending",
          `Your purchase is waiting for approval from ${STORE_NAME}. Alerts turn on as soon as it completes.`
        );
      } else if (outcome === "not-entitled") {
        Alert.alert(
          "Almost there",
          "Your purchase went through but hasn't reached your account yet. Pull down on the dashboard in a minute, or contact support from Settings."
        );
      }
    } catch (e: any) {
      Alert.alert("Purchase failed", e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    setBusy("restore");
    try {
      const ok = await restore();
      if (ok) {
        await finishUnlocked("Purchases restored", "Your subscription is active on this account.");
      } else {
        Alert.alert("Nothing to restore", `No active TattleTow subscription was found for ${COPY.billingAccount}.`);
      }
    } catch (e: any) {
      Alert.alert("Restore failed", e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const price = offer ? `${offer.priceString} per ${offer.periodLabel}` : null;

  return (
    <IosPage>
      <IosNavBar title={COPY.navTitle} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <IosCard style={styles.card}>
          <Text style={styles.title}>{COPY.title}</Text>
          <Text style={styles.subtitle}>{COPY.subtitle}</Text>
          <Text style={styles.pitch}>{COPY.pitch}</Text>

          {loading ? (
            <ActivityIndicator color={colors.blue} style={{ marginVertical: 16 }} />
          ) : !offer ? (
            <Text style={styles.unavailable}>{COPY.unavailable}</Text>
          ) : (
            <>
              <Text style={styles.price}>{price}</Text>
              {offer.trialLabel && <Text style={styles.trial}>Starts with a {offer.trialLabel}</Text>}
            </>
          )}
        </IosCard>

        <IosButton
          variant="green"
          onPress={onBuy}
          disabled={!offer || busy !== null}
          loading={busy === "buy"}
          style={{ marginTop: 16 }}
        >
          {offer?.trialLabel ? `Start ${offer.trialLabel}` : "Subscribe"}
        </IosButton>

        <IosButton
          variant="silver"
          onPress={onRestore}
          disabled={!IAP_AVAILABLE || busy !== null}
          loading={busy === "restore"}
          style={{ marginTop: 10 }}
        >
          Restore Purchases
        </IosButton>

        {offer && (
          <Text style={styles.terms}>
            {offer.trialLabel
              ? `Your ${offer.trialLabel} begins today. When it ends, you'll be charged ${price} unless you cancel ${COPY.cancelBefore} the trial ends. `
              : `You'll be charged ${price} when you confirm your purchase. `}
            Payment is charged to {COPY.billingAccount}. The subscription renews automatically each {offer.periodLabel} at{" "}
            {offer.priceString} unless cancelled {COPY.cancelBefore} the end of the current period. Manage or cancel
            any time in {COPY.cancelWhere}.
          </Text>
        )}

        <View style={styles.links}>
          <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}>
            Terms of Use
          </Text>
          <Text style={styles.linkSep}>·</Text>
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>
            Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, fontFamily },
  subtitle: { fontSize: 14, color: colors.textLight, fontFamily, marginTop: 2 },
  pitch: { fontSize: 14, color: colors.text, fontFamily, lineHeight: 20, marginTop: 12 },
  price: { fontSize: 20, fontWeight: "700", color: colors.text, fontFamily, marginTop: 16 },
  trial: { fontSize: 14, color: colors.green, fontFamily, marginTop: 4, fontWeight: "700" },
  unavailable: { fontSize: 14, color: colors.textLight, fontFamily, marginTop: 16, lineHeight: 20 },
  terms: { fontSize: 12, color: colors.textLight, fontFamily, lineHeight: 17, marginTop: 16 },
  links: { flexDirection: "row", justifyContent: "center", marginTop: 16, gap: 8 },
  link: { fontSize: 13, color: colors.blue, fontFamily, textDecorationLine: "underline" },
  linkSep: { fontSize: 13, color: colors.textLight, fontFamily },
});
