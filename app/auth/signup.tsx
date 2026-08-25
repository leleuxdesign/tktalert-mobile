import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { MapPin, ChevronRight, Check } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import {
  IosPage,
  IosNavBar,
  IosStepDots,
  IosErrorBanner,
  IosFormCard,
  IosFormRow,
  IosInput,
  IosButton,
  IosTable,
  IosTableRow,
  IosTableRowLabel,
  IosIconCell,
  IosCard,
  IosAppIcon,
} from "@/components/ios6";

const DISCLAIMER =
  "TattleTow monitors parking complaints filed with the City of Milwaukee — not parking enforcement activity. A notification means a complaint has been filed near your registered zone. It does not mean a parking ticket has been issued, is being issued, or will be issued. TattleTow makes no guarantee that a complaint will result in enforcement action, nor that all complaints filed in your zone will be captured. Use of this service does not constitute legal advice. TattleTow is not affiliated with the City of Milwaukee or any municipal authority.";

type Step = 1 | 2 | 3 | 4 | 5 | "success";
const STEP_TITLES: Record<number, string> = {
  1: "Select City",
  2: "Your Account",
  3: "Your Address",
  4: "Confirm Zone",
  5: "Consent",
};

export default function SignupScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    city: "Milwaukee",
    email: "",
    password: "",
    phone: "",
    street: "",
    centerAddress: "",
    label: "",
    consentChecked: false,
    consentTimestamp: "",
  });

  const registerMutation = trpc.auth.register.useMutation();
  const updateProfile = trpc.auth.updateProfile.useMutation();
  const recordConsent = trpc.auth.recordConsent.useMutation();
  const createZone = trpc.zones.create.useMutation();

  const updateForm = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleNext = async () => {
    setError("");
    try {
      if (step === 1) {
        if (!form.city.trim()) return setError("Please select a city.");
        setStep(2);
      } else if (step === 2) {
        // Validate only. The account is deliberately NOT created here — see the
        // comment on step 5 — so abandoning the wizard leaves nothing behind.
        if (!form.email.trim()) return setError("Email is required.");
        if (!form.password || form.password.length < 8)
          return setError("Password must be at least 8 characters.");
        setStep(3);
      } else if (step === 3) {
        if (!form.street.trim()) return setError("Street name is required.");
        if (!form.centerAddress || isNaN(Number(form.centerAddress)))
          return setError("Enter a valid house number.");
        setStep(4);
      } else if (step === 4) {
        setStep(5);
      } else if (step === 5) {
        if (!form.consentChecked) return setError("You must accept the disclaimer to continue.");

        // Register last, then run the follow-up mutations on the session cookie
        // that register sets.
        //
        // auth.me is deliberately NOT invalidated here: the root AuthGuard
        // redirects out of the `auth` group the moment it sees an authenticated
        // user, and invalidating mid-wizard is exactly what used to fire that
        // redirect early — skipping address, zone, and consent entirely and
        // leaving every new account with consentGivenAt NULL and zero zones.
        // The refresh happens on the success screen instead.
        let data: any;
        try {
          data = await registerMutation.mutateAsync({
            email: form.email.trim().toLowerCase(),
            password: form.password,
          });
        } catch (err: any) {
          // Send them back to the account step, where the email lives.
          setStep(2);
          setError(err?.message ?? "Could not create that account. Try a different email.");
          return;
        }

        if (data?.user) await AsyncStorage.setItem("auth_user", JSON.stringify(data.user));
        if (form.phone.trim()) await updateProfile.mutateAsync({ phone: form.phone.trim() });
        await recordConsent.mutateAsync();
        await createZone.mutateAsync({
          street: form.street,
          centerAddress: Number(form.centerAddress),
          label: form.label || undefined,
        });
        setStep("success");
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    }
  };

  const currentStepNum = step === "success" ? 5 : step;

  if (step === "success") {
    return (
      <IosPage>
        <IosNavBar title="Account Created" />
        <View style={styles.successWrap}>
          <IosAppIcon size={80} gradient={gradients.appIconGreen}>
            <Check size={40} color="#fff" strokeWidth={3} />
          </IosAppIcon>
          <Text style={styles.successTitle}>You're all set!</Text>
          <Text style={styles.successBody}>
            Your watch zone has been created. You'll receive SMS and email alerts whenever a
            complaint is filed near{" "}
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {form.centerAddress} {form.street}
            </Text>
            .
          </Text>
          <View style={{ paddingHorizontal: 16, width: "100%" }}>
            <IosButton
              variant="blue"
              onPress={async () => {
                // Now that the wizard is finished it is safe to let the guard
                // see the authenticated session.
                await utils.auth.me.invalidate();
                router.replace("/tabs/dashboard");
              }}
            >
              Go to Dashboard →
            </IosButton>
          </View>
        </View>
      </IosPage>
    );
  }

  const isBusy = registerMutation.isPending || updateProfile.isPending || recordConsent.isPending || createZone.isPending;

  return (
    <IosPage>
      <IosNavBar
        title={STEP_TITLES[currentStepNum]}
        onBack={currentStepNum > 1 ? () => setStep((currentStepNum - 1) as Step) : () => router.back()}
        backLabel={currentStepNum > 1 ? "Back" : "Back"}
      />
      <IosStepDots total={5} current={currentStepNum} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
          {error ? <IosErrorBanner>{error}</IosErrorBanner> : null}

          {step === 1 && (
            <View>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Select Your City</Text>
                <Text style={styles.stepSubtitle}>TattleTow currently covers Milwaukee, WI.</Text>
              </View>
              <IosTable style={{ marginHorizontal: 16 }}>
                <IosTableRow onPress={() => updateForm("city", "Milwaukee")} last>
                  <IosIconCell gradient={gradients.iconBlue}>
                    <MapPin size={16} color="#fff" />
                  </IosIconCell>
                  <IosTableRowLabel>Milwaukee, WI</IosTableRowLabel>
                  {form.city === "Milwaukee" && <Text style={styles.checkmark}>✓</Text>}
                </IosTableRow>
              </IosTable>
              <View style={styles.stepFooter}>
                <IosButton variant="blue" onPress={handleNext}>
                  Continue →
                </IosButton>
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Your Account</Text>
                <Text style={styles.stepSubtitle}>Create your account to continue.</Text>
              </View>
              <IosFormCard>
                <IosFormRow>
                  <IosInput
                    placeholder="Email"
                    value={form.email}
                    onChangeText={(v) => updateForm("email", v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={styles.bareInput}
                  />
                </IosFormRow>
                <IosFormRow>
                  <IosInput
                    placeholder="Password (min 8 chars)"
                    value={form.password}
                    onChangeText={(v) => updateForm("password", v)}
                    secureTextEntry
                    style={styles.bareInput}
                  />
                </IosFormRow>
                <IosFormRow last>
                  <IosInput
                    placeholder="Phone number (optional — for SMS alerts)"
                    value={form.phone}
                    onChangeText={(v) => updateForm("phone", v)}
                    keyboardType="phone-pad"
                    style={styles.bareInput}
                  />
                </IosFormRow>
              </IosFormCard>
              <View style={styles.stepFooter}>
                <IosButton variant="blue" onPress={handleNext} loading={isBusy}>
                  Continue →
                </IosButton>
              </View>
            </View>
          )}

          {step === 3 && (
            <View>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Your Address</Text>
                <Text style={styles.stepSubtitle}>Enter the address you want to monitor.</Text>
              </View>
              <IosFormCard>
                <IosFormRow>
                  <FormLabelInput label="Street" placeholder="e.g. N Water St" value={form.street} onChangeText={(v) => updateForm("street", v)} />
                </IosFormRow>
                <IosFormRow>
                  <FormLabelInput label="House #" placeholder="e.g. 1234" value={form.centerAddress} onChangeText={(v) => updateForm("centerAddress", v)} keyboardType="number-pad" />
                </IosFormRow>
                <IosFormRow last>
                  <FormLabelInput label="Label" placeholder="Optional — e.g. Home" value={form.label} onChangeText={(v) => updateForm("label", v)} />
                </IosFormRow>
              </IosFormCard>
              <View style={styles.stepFooter}>
                <IosButton variant="blue" onPress={handleNext}>
                  Continue →
                </IosButton>
              </View>
            </View>
          )}

          {step === 4 && (
            <View>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Confirm Zone</Text>
                <Text style={styles.stepSubtitle}>We apply a ±100 address range automatically.</Text>
              </View>
              <IosTable style={{ marginHorizontal: 16 }}>
                {[
                  { label: "Street", value: form.street },
                  { label: "Center", value: form.centerAddress },
                  { label: "Range Min", value: String(Math.max(0, Number(form.centerAddress) - 100)) },
                  { label: "Range Max", value: String(Number(form.centerAddress) + 100) },
                  ...(form.label ? [{ label: "Label", value: form.label }] : []),
                ].map((row, i, arr) => (
                  <IosTableRow key={row.label} last={i === arr.length - 1}>
                    <IosTableRowLabel>{row.label}</IosTableRowLabel>
                    <Text style={styles.rowValue}>{row.value}</Text>
                  </IosTableRow>
                ))}
              </IosTable>
              <View style={[styles.stepFooter, { flexDirection: "row", gap: 12 }]}>
                <IosButton variant="silver" flex={1} onPress={() => setStep(3)}>
                  ← Edit
                </IosButton>
                <IosButton variant="blue" flex={2} onPress={handleNext}>
                  Looks Good →
                </IosButton>
              </View>
            </View>
          )}

          {step === 5 && (
            <View>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Review & Consent</Text>
                <Text style={styles.stepSubtitle}>Please read and accept the disclaimer.</Text>
              </View>
              <IosCard style={{ marginHorizontal: 16, padding: 14, maxHeight: 180 }}>
                <ScrollView>
                  <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
                </ScrollView>
              </IosCard>
              <IosTable style={{ marginHorizontal: 16, marginTop: 16 }}>
                <Pressable
                  style={styles.consentRow}
                  onPress={() => {
                    const next = !form.consentChecked;
                    updateForm("consentChecked", next);
                    if (next) updateForm("consentTimestamp", new Date().toISOString());
                  }}
                >
                  <View style={[styles.checkbox, form.consentChecked && styles.checkboxChecked]}>
                    {form.consentChecked && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.consentText}>
                      I have read and agree to the disclaimer above. I understand that TattleTow
                      monitors complaints, not enforcement activity.
                    </Text>
                    {form.consentTimestamp ? (
                      <Text style={styles.consentTimestamp}>
                        Acknowledged at {new Date(form.consentTimestamp).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </IosTable>
              <View style={styles.stepFooter}>
                <IosButton variant="green" onPress={handleNext} loading={isBusy}>
                  Complete Sign Up →
                </IosButton>
              </View>
            </View>
          )}

          <Link href="/auth/login" asChild>
            <Text style={styles.footerLink}>Already have an account? Sign In</Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </IosPage>
  );
}

function FormLabelInput({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof IosInput>) {
  return (
    <View style={{ minHeight: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <IosInput {...props} style={[styles.bareInput, { paddingLeft: 0, flex: 1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stepHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  stepTitle: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 4, fontFamily },
  stepSubtitle: { fontSize: 14, color: colors.textLight, fontFamily },
  stepFooter: { padding: 16, paddingTop: 20 },
  bareInput: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, paddingVertical: 13, paddingHorizontal: 16, height: undefined },
  footerLink: { textAlign: "center", color: colors.blue, fontSize: 14, paddingHorizontal: 16, paddingBottom: 16, fontFamily },
  checkmark: { color: colors.blue, fontSize: 20, fontWeight: "700" },
  rowValue: { fontSize: 17, color: colors.textLight, fontFamily },
  inlineLabel: { fontSize: 17, color: colors.text, minWidth: 90, fontFamily },
  disclaimer: { fontSize: 12, color: colors.textLight, lineHeight: 18, fontFamily },
  consentRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
    backgroundColor: "#e0e0e5", borderWidth: 1, borderColor: colors.separator,
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.green, borderColor: "#1d9933" },
  consentText: { fontSize: 14, color: colors.text, lineHeight: 19, fontFamily },
  consentTimestamp: { fontSize: 11, color: colors.textLight, marginTop: 4, fontFamily },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 8 },
  successTitle: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 16, fontFamily },
  successBody: { fontSize: 15, color: colors.textLight, lineHeight: 21, textAlign: "center", marginBottom: 24, fontFamily },
});
