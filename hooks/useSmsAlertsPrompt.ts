/**
 * "Want text alerts too?" — the one-time ask that fires the moment texts
 * actually become available to this account.
 *
 * Why it exists (Owner-approved for 1.1): SMS consent is collected at signup,
 * but a free account cannot receive texts, so plenty of people sign up with the
 * box unchecked — correctly, since it would have bought them nothing. When they
 * subscribe later, `map.access().alertChannels.sms` flips true and the server
 * would happily text them, except `smsConsentAt` is null, so every SMS send is
 * refused (A2P 10DLC / TCPA gate in server/sms.ts). The result is a paying
 * customer silently missing a channel they're paying for. This asks once, at
 * the only moment the ask is meaningful.
 *
 * What this hook deliberately does NOT do:
 *   - It does not collect consent. There is exactly one place that records
 *     consent (Settings → Text Alerts, with the disclosures filed in the A2P
 *     campaign), and this prompt sends the user there. Paraphrasing the
 *     disclosure here would create a second, unfiled version of it.
 *   - It does not nag. It shows once, ever, per install; dismissing it is
 *     final. The "shown" flag is written BEFORE the alert renders, so an
 *     Android back-button dismissal counts as shown too.
 *
 * The free→paid transition is detected against a tier persisted in
 * AsyncStorage rather than a previous render, so it survives the app being
 * killed while the customer is in the browser paying Stripe. A fresh install by
 * an already-paid user has no stored tier and therefore no transition — correct:
 * we only ask people for whom texts just turned on.
 */
import { useEffect } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MapAccess } from "@/lib/router-types";

/*
  Both flags are scoped to the account, not the install: a device that has been
  signed into two accounts must not let one person's dismissal, or one person's
  tier history, decide anything for the other.
*/
/** Set once, forever: the prompt has been seen (or dismissed). */
export const SMS_PROMPT_SHOWN_KEY = "sms_alerts_prompt_shown";
/** Last tier we observed for this account: "free" | "paid". */
export const SMS_PROMPT_TIER_KEY = "sms_alerts_last_tier";

const shownKey = (userId: number) => `${SMS_PROMPT_SHOWN_KEY}:${userId}`;
const tierKey = (userId: number) => `${SMS_PROMPT_TIER_KEY}:${userId}`;

export const SMS_PROMPT_TITLE = "Want text alerts too?";
/** No number on file — Settings needs one before the switch can be turned on. */
export const SMS_PROMPT_BODY_NO_PHONE =
  "Text alerts reach you when your phone is silenced. Add your number in Settings.";
/** Number already on file, consent isn't — only the switch is left. */
export const SMS_PROMPT_BODY_HAS_PHONE =
  "Text alerts reach you when your phone is silenced. Turn on text alerts in Settings.";
export const SMS_PROMPT_DISMISS = "Not now";
export const SMS_PROMPT_ACCEPT_NO_PHONE = "Add number →";
export const SMS_PROMPT_ACCEPT_HAS_PHONE = "Open Settings →";

export interface SmsAlertsPromptArgs {
  /** map.access() — the authority on tier and which channels are usable. */
  access: MapAccess | undefined;
  /**
   * `auth.me().id`, or null while it is unknown. Non-null also means auth.me
   * has answered from the server this session — the cached `auth_user` blob is
   * not good enough, since if it predates a consent change we would ask
   * someone who has already consented.
   */
  userId: number | null;
  /** `auth.me().smsConsentAt` non-null — express consent already on file. */
  hasConsent: boolean;
  /** `auth.me().phone` non-empty. Changes the wording, not the destination. */
  hasPhone: boolean;
  /** Send the user to Settings (the real consent flow). */
  onOpenSettings: () => void;
}

export function useSmsAlertsPrompt({
  access,
  userId,
  hasConsent,
  hasPhone,
  onOpenSettings,
}: SmsAlertsPromptArgs) {
  useEffect(() => {
    const tier = access?.tier;
    if (tier !== "free" && tier !== "paid") return; // still loading
    if (userId == null) return; // don't judge consent from a stale cache

    const smsAvailable = !!access?.alertChannels?.sms;
    let cancelled = false;

    (async () => {
      const storedTier = await AsyncStorage.getItem(tierKey(userId));
      if (cancelled) return;

      const becamePaid = storedTier === "free" && tier === "paid";

      // Paid but SMS not offered yet (server disagreeing with itself, or a
      // channel rollout): hold the transition open rather than burning it, so
      // the ask still happens on the pass where texts really are available.
      if (tier === "paid" && storedTier === "free" && !smsAvailable) return;

      if (storedTier !== tier) await AsyncStorage.setItem(tierKey(userId), tier);
      if (cancelled || !becamePaid || !smsAvailable || hasConsent) return;

      const alreadyShown = await AsyncStorage.getItem(shownKey(userId));
      if (cancelled || alreadyShown) return;

      // Written first: any dismissal — button, tap-outside, hardware back —
      // must be the last time this is ever shown.
      await AsyncStorage.setItem(shownKey(userId), new Date().toISOString());
      if (cancelled) return;

      Alert.alert(
        SMS_PROMPT_TITLE,
        hasPhone ? SMS_PROMPT_BODY_HAS_PHONE : SMS_PROMPT_BODY_NO_PHONE,
        [
          { text: SMS_PROMPT_DISMISS, style: "cancel" },
          {
            text: hasPhone ? SMS_PROMPT_ACCEPT_HAS_PHONE : SMS_PROMPT_ACCEPT_NO_PHONE,
            onPress: onOpenSettings,
          },
        ]
      );
    })();

    return () => {
      cancelled = true;
    };
    // `onOpenSettings` is intentionally not a dependency: it is recreated every
    // render, and re-running this effect on every render risks a double prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.tier, access?.alertChannels?.sms, userId, hasConsent, hasPhone]);
}
