/**
 * "Want text alerts too?" — the one-time ask for any paid account that can
 * receive texts but has no consent on file.
 *
 * Why it exists (Owner-approved for 1.1): SMS consent is collected at signup,
 * but a free account cannot receive texts, so plenty of people sign up with the
 * box unchecked — correctly, since it would have bought them nothing. Once they
 * subscribe, `map.access().alertChannels.sms` is true and the server would
 * happily text them, except `smsConsentAt` is null, so every SMS send is
 * refused (A2P 10DLC / TCPA gate in server/sms.ts). The result is a paying
 * customer silently missing a channel they're paying for.
 *
 * The rule is a STATE, not an event (White, 2026-09-19): paid + SMS available +
 * no consent on file + never asked. An earlier version required observing a
 * free→paid transition in the app, which missed the launch-critical cohort —
 * people subscribe on the web, so anyone who subscribes first and installs the
 * app afterwards never transitions anywhere this code can see.
 *
 * What this hook deliberately does NOT do:
 *   - It does not collect consent. There is exactly one place that records
 *     consent (Settings → Text Alerts, with the disclosures filed in the A2P
 *     campaign), and this prompt sends the user there. Paraphrasing the
 *     disclosure here would create a second, unfiled version of it.
 *   - It does not nag. The once-per-account "shown" flag is the only thing
 *     stopping it, so it is written BEFORE the alert renders: dismissal by the
 *     button, by tapping outside, or by the Android back button all count.
 *   - It does not fire on unanswered data. Both `auth.me` and `map.access` must
 *     have answered from the server this session; the cached `auth_user` blob
 *     is not trusted to say whether consent exists, and no answer at all is not
 *     the same as "free".
 */
import { useEffect } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MapAccess } from "@/lib/router-types";

/**
 * Set once, forever: the prompt has been seen (or dismissed). Scoped to the
 * account, not the install — a device that has been signed into two accounts
 * must not let one person's dismissal silence the other person's ask.
 */
export const SMS_PROMPT_SHOWN_KEY = "sms_alerts_prompt_shown";

const shownKey = (userId: number) => `${SMS_PROMPT_SHOWN_KEY}:${userId}`;

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
    // `map.access` must have answered: an absent tier is "we don't know yet",
    // which is not the same as free, and must not consume the one ask.
    if (access?.tier !== "paid") return;
    // SMS is the whole point. Paid without it (a channel rollout, or the server
    // disagreeing with itself) means there is nothing to ask for yet.
    if (!access?.alertChannels?.sms) return;
    // Null = auth.me hasn't answered this session; don't judge consent from the
    // cached blob, and don't ask someone who already consented.
    if (userId == null || hasConsent) return;

    let cancelled = false;

    (async () => {
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
