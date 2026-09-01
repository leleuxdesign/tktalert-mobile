/**
 * The SMS opt-in block — the mobile twin of
 * `tktalert-app/client/src/components/SmsConsentBlock.tsx`.
 *
 * The copy in here is filed with Twilio in the A2P 10DLC campaign registration.
 * The web component and this one must not drift: a vetter who is shown the web
 * form and then installs the Android app has to read the same words in both
 * places. Every user-facing string below is a verbatim copy of the web block.
 *
 * What has to stay true here (same four rules as the web component):
 *   1. The label text is verbatim what was filed in the campaign registration.
 *   2. The checkbox is separate from the required disclaimer consent, unchecked
 *      by default, and never gates completing signup or paying.
 *   3. The phone field renders unconditionally, on the same screen, immediately
 *      above the checkbox — so it is visibly the number consent applies to.
 *   4. All four disclosures (type, frequency, rates, opt-out) render as plain
 *      visible text next to the checkbox — never behind a link, tooltip, or
 *      modal.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Linking from "expo-linking";
import { Check } from "lucide-react-native";
import { colors, fontFamily } from "@/lib/ios6-theme";
import { IosInput, IosSectionLabel, IosTable } from "@/components/ios6";

/** Filed with Twilio in the campaign registration. Do not reword. */
export const SMS_CONSENT_LABEL =
  "Yes, text me parking-complaint alerts for my watch zones. Msg & data rates may apply. Msg frequency varies. Reply STOP to cancel, HELP for help.";

/**
 * The web app serves these three documents; the app has no in-app copies, so
 * the links open the same URLs in the system browser.
 */
const TERMS_URL = "https://app.tattletow.com/terms";
const PRIVACY_URL = "https://app.tattletow.com/privacy";
const SMS_PROGRAM_URL = "https://app.tattletow.com/sms-alerts";

function openExternal(url: string) {
  Linking.openURL(url).catch(() => {
    /* No browser available — the disclosures above are already on screen. */
  });
}

interface SmsConsentBlockProps {
  phone: string;
  onPhoneChange: (value: string) => void;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** ISO timestamp shown as a receipt once the user opts in. */
  consentedAt?: string;
  /** Outer horizontal gutter, so each screen can match its own layout. */
  marginHorizontal?: number;
}

export default function SmsConsentBlock({
  phone,
  onPhoneChange,
  checked,
  onCheckedChange,
  consentedAt,
  marginHorizontal = 16,
}: SmsConsentBlockProps) {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={{ paddingHorizontal: marginHorizontal }}>
        <IosSectionLabel>Text alerts (optional)</IosSectionLabel>
      </View>

      <IosTable style={{ marginHorizontal }}>
        {/* Phone — deliberately above the checkbox, on the same card. */}
        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.phoneLabel}>Mobile number for text alerts</Text>
          <IosInput
            placeholder="(414) 555-0123"
            value={phone}
            onChangeText={onPhoneChange}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            style={styles.phoneInput}
          />
        </View>

        {/* The opt-in itself. Unchecked by default; never required. */}
        <Pressable
          onPress={() => onCheckedChange(!checked)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={SMS_CONSENT_LABEL}
          style={[styles.row, styles.rowBorder, styles.checkboxRow]}
        >
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && <Check size={14} color="#fff" strokeWidth={3} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.consentLabel}>{SMS_CONSENT_LABEL}</Text>
            {consentedAt ? (
              <Text style={styles.receipt}>
                Opted in at {new Date(consentedAt).toLocaleString()}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {/* The four disclosures, as plain visible text. */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.disclosure}>
              <Text style={styles.disclosureStrong}>Message type:</Text> parking-complaint alerts
              for the watch zones on your account.
            </Text>
            <Text style={styles.disclosure}>
              <Text style={styles.disclosureStrong}>Message frequency:</Text> message frequency
              varies — typically 0–5 messages per week.
            </Text>
            <Text style={styles.disclosure}>
              <Text style={styles.disclosureStrong}>Cost:</Text> Msg & data rates may apply.
            </Text>
            <Text style={styles.disclosure}>
              <Text style={styles.disclosureStrong}>To opt out:</Text> Reply STOP to cancel, HELP
              for help.
            </Text>
            <Text style={[styles.disclosure, { marginTop: 6 }]}>
              Consent to receive text messages is optional. It is not required to sign up for, buy,
              or use TattleTow, and you can complete sign-up with this box unchecked. See our{" "}
              <Text style={styles.link} onPress={() => openExternal(TERMS_URL)}>
                Terms
              </Text>
              ,{" "}
              <Text style={styles.link} onPress={() => openExternal(PRIVACY_URL)}>
                Privacy Policy
              </Text>
              , and{" "}
              <Text style={styles.link} onPress={() => openExternal(SMS_PROGRAM_URL)}>
                text-alert program details
              </Text>
              .
            </Text>
          </View>
        </View>
      </IosTable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.white },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  phoneLabel: { fontSize: 13, color: colors.textLight, marginBottom: 6, fontFamily },
  phoneInput: { height: 42, fontSize: 17, borderRadius: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    flexShrink: 0,
    backgroundColor: "#e0e0e5",
    borderWidth: 1,
    borderColor: colors.separator,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.green, borderColor: "#1d9933" },
  consentLabel: { fontSize: 14, color: colors.text, lineHeight: 19, fontFamily },
  receipt: { fontSize: 11, color: colors.textLight, marginTop: 4, fontFamily },
  disclosure: { fontSize: 12, color: colors.textLight, lineHeight: 18, fontFamily },
  disclosureStrong: { fontWeight: "700", color: colors.text },
  link: { color: colors.blue },
});
