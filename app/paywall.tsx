import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { colors, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosButton, IosCard } from "@/components/ios6";
import { IAP_AVAILABLE, loadOffer, pollServerEntitlement, purchase, restore, type PaywallOffer } from "@/lib/purchases";

/**
 * Subscription paywall (Owner ruling D-13; Apple Guideline 3.1.2 / Schedule 2).
 *
 * Shows, before purchase: the subscription's name and length, the renewal price
 * as the most prominent price, the free trial (only when the store says this
 * user is eligible) and what it costs afterwards, auto-renewal and how to
 * cancel, Terms of Use and Privacy Policy links, and Restore Purchases.
 *
 * Price and trial come from the store via RevenueCat — never hardcoded. Only
 * reachable from signed-in screens, so every purchase is tied to an account
 * (and its email) through `Purchases.logIn(userId)` in the root layout.
 *
 * Copy: Fran, marketing/COPY-IAP-LAUNCH.md §4 (2026-10-07), with the store's
 * price and trial length substituted for the US "$3.99" / "14-day" examples.
 */

// Terms: Apple's standard EULA until our own Terms page is rewritten for IAP
// (tattletow.com/terms still describes Stripe billing) — Fran decision 4, E.L.
const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = "https://tattletow.com/privacy";

const IOS = Platform.OS === "ios";

const COPY = {
  navTitle: "Subscribe",
  title: "TattleTow Monthly",
  lead: "Get a heads-up when a parking complaint is filed where you park.",
  bullets: [
    "Alerts by push, text or email when a complaint is filed in your watch zones",
    "Watch zones anywhere in Milwaukee",
    "City records checked every five minutes, around the clock",
  ],
  unavailable: "Subscriptions aren't available in the app yet. Please check back soon.",
  account: (email: string) => `Signed in as ${email}. Your subscription is tied to this account.`,
  finePrint: (o: PaywallOffer) => {
    const cost = `${o.priceString} a ${o.periodLabel}`;
    if (IOS) {
      return o.trialLength
        ? `Your ${o.trialLength} free trial starts today. When it ends, TattleTow Monthly costs ${cost}, charged to your Apple Account. It renews automatically each ${o.periodLabel} unless you cancel at least 24 hours before the trial or current ${o.periodLabel} ends. Cancel anytime in your App Store subscriptions.`
        : `TattleTow Monthly costs ${cost}, charged to your Apple Account when you confirm. It renews automatically each ${o.periodLabel} unless you cancel at least 24 hours before the current ${o.periodLabel} ends. Cancel anytime in your App Store subscriptions.`;
    }
    return o.trialLength
      ? `Your ${o.trialLength} free trial starts today. When it ends, TattleTow Monthly costs ${cost}, charged to your Google Play account, and renews automatically each ${o.periodLabel} until you cancel. Cancel before the trial ends and you won't be charged. Cancel anytime in your Google Play subscriptions.`
      : `TattleTow Monthly costs ${cost}, charged to your Google Play account when you confirm, and renews automatically each ${o.periodLabel} until you cancel. Cancel anytime in your Google Play subscriptions.`;
  },
  trialStarted: "Your free trial has started. TattleTow is watching your zones.",
  subscribed: "You're subscribed. TattleTow is watching your zones.",
  pending: IOS
    ? "Your payment is pending. Alerts turn on as soon as the App Store confirms it."
    : "Your payment is pending. Alerts turn on as soon as Google Play confirms it.",
  restored: "Your subscription is restored. Alerts are on.",
  restoreNone: IOS
    ? "We couldn't find a TattleTow subscription on this Apple Account."
    : "We couldn't find a TattleTow subscription on this Google account.",
  notYetCredited:
    "Your purchase went through but hasn't reached your account yet. Pull down on the dashboard in a minute, or message us from Support in Settings.",
  storeError: "Something went wrong. Check your connection and try again.",
  // Fran §4, without the email address while support@ vs help@ is open (Fran decision 2).
  otherAccount:
    "This subscription is linked to a different TattleTow account. Sign in with that email, or message us from Support in Settings.",
};

export default function PaywallScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery();
  const email: string | undefined = meQuery.data?.email;
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
    async (message: string) => {
      // Server is the source of truth (RevenueCat webhook); refresh it now and
      // rely on the optimistic store entitlement until the webhook lands.
      await utils.auth.me.invalidate();
      pollServerEntitlement(() => utils.auth.me.fetch(undefined, { staleTime: 0 }));
      Alert.alert("TattleTow", message, [{ text: "OK", onPress: () => router.back() }]);
    },
    [utils, router]
  );

  const onBuy = async () => {
    if (!offer) return;
    setBusy("buy");
    try {
      const outcome = await purchase(offer.pkg);
      if (outcome === "success") await finishUnlocked(offer.trialLength ? COPY.trialStarted : COPY.subscribed);
      else if (outcome === "pending") Alert.alert("TattleTow", COPY.pending);
      else if (outcome === "not-entitled") Alert.alert("TattleTow", COPY.notYetCredited);
      else if (outcome === "other-account") Alert.alert("TattleTow", COPY.otherAccount);
      // "cancelled": no message; leave them on the paywall.
    } catch {
      Alert.alert("TattleTow", COPY.storeError);
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    setBusy("restore");
    try {
      const outcome = await restore();
      if (outcome === "restored") await finishUnlocked(COPY.restored);
      else if (outcome === "other-account") Alert.alert("TattleTow", COPY.otherAccount);
      else Alert.alert("TattleTow", COPY.restoreNone);
    } catch {
      Alert.alert("TattleTow", COPY.storeError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <IosPage>
      <IosNavBar title={COPY.navTitle} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <IosCard style={styles.card}>
          <Text style={styles.title}>{COPY.title}</Text>
          <Text style={styles.lead}>{COPY.lead}</Text>
          {COPY.bullets.map((b) => (
            <Text key={b} style={styles.bullet}>
              •  {b}
            </Text>
          ))}

          {loading ? (
            <ActivityIndicator color={colors.blue} style={{ marginTop: 16 }} />
          ) : !offer ? (
            <Text style={styles.unavailable}>{COPY.unavailable}</Text>
          ) : (
            <>
              <Text style={styles.price}>
                {offer.priceString}/{offer.periodLabel}
              </Text>
              {offer.trialLength && (
                <Text style={styles.trial}>{offer.trialLength} free trial for new subscribers</Text>
              )}
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
          {offer?.trialLength
            ? "Start free trial"
            : offer
              ? `Subscribe for ${offer.priceString}/${offer.periodLabel}`
              : "Subscribe"}
        </IosButton>

        {offer && <Text style={styles.finePrint}>{COPY.finePrint(offer)}</Text>}
        {email && <Text style={styles.account}>{COPY.account(email)}</Text>}

        <View style={styles.links}>
          <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}>
            Terms of Use
          </Text>
          <Text style={styles.linkSep}>·</Text>
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>
            Privacy Policy
          </Text>
          <Text style={styles.linkSep}>·</Text>
          <Text
            style={[styles.link, (!IAP_AVAILABLE || busy !== null) && styles.linkDisabled]}
            onPress={IAP_AVAILABLE && busy === null ? onRestore : undefined}
          >
            {busy === "restore" ? "Restoring…" : "Restore Purchases"}
          </Text>
        </View>
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, fontFamily },
  lead: { fontSize: 14, color: colors.text, fontFamily, lineHeight: 20, marginTop: 8 },
  bullet: { fontSize: 13, color: colors.text, fontFamily, lineHeight: 19, marginTop: 6 },
  // Apple Schedule 2: the billed amount is the most prominent price on screen.
  price: { fontSize: 26, fontWeight: "700", color: colors.text, fontFamily, marginTop: 18 },
  trial: { fontSize: 14, color: colors.textLight, fontFamily, marginTop: 4 },
  unavailable: { fontSize: 14, color: colors.textLight, fontFamily, marginTop: 16, lineHeight: 20 },
  finePrint: { fontSize: 12, color: colors.textLight, fontFamily, lineHeight: 17, marginTop: 12 },
  account: { fontSize: 12, color: colors.textLight, fontFamily, lineHeight: 17, marginTop: 10 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 18, gap: 8 },
  link: { fontSize: 13, color: colors.blue, fontFamily, textDecorationLine: "underline" },
  linkDisabled: { color: colors.textFaint, textDecorationLine: "none" },
  linkSep: { fontSize: 13, color: colors.textLight, fontFamily },
});
