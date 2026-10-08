import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, BackHandler } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosNavBar, IosCard, IosButton, IosErrorBanner } from "@/components/ios6";
import { SERVICE_DISCLAIMER } from "@/lib/disclaimer";

/**
 * Service-disclaimer acknowledgement for accounts that never saw the signup
 * wizard (IAP-CONTRACT.md §2.1): accounts made on the temporary web signup
 * form, or by an admin, arrive with `consentGivenAt` null and no zones.
 *
 * Not dismissible: no back button, no swipe, Android back is swallowed. On
 * accept, `auth.recordConsent()` with NO input — the default scope stamps only
 * `consentGivenAt` and leaves any SMS consent from the web form untouched.
 * The tabs gate (app/tabs/_layout.tsx) then routes a zoneless account to add one.
 */
export default function ConsentScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const recordConsent = trpc.auth.recordConsent.useMutation();

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const onContinue = async () => {
    if (!checked) return setError("You must accept the disclaimer to continue.");
    setError("");
    try {
      await recordConsent.mutateAsync(undefined);
      await utils.auth.me.invalidate();
      // Back to the tabs; their gate sends a zoneless account on to add a zone.
      if (router.canGoBack()) router.back();
      else router.replace("/tabs/dashboard");
    } catch (e: any) {
      setError(e?.message || "Couldn't save that. Check your connection and try again.");
    }
  };

  return (
    <IosPage>
      <IosNavBar title="Before You Start" />
      <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
        <Text style={styles.intro}>Please read and accept this before using TattleTow.</Text>
        <IosCard style={{ marginHorizontal: 16, padding: 14 }}>
          <Text style={styles.disclaimer}>{SERVICE_DISCLAIMER}</Text>
        </IosCard>
        <Pressable style={styles.row} onPress={() => setChecked((c) => !c)}>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && <Check size={14} color="#fff" strokeWidth={3} />}
          </View>
          <Text style={styles.rowText}>
            I have read and agree to the disclaimer above. I understand that TattleTow monitors complaints, not
            enforcement activity.
          </Text>
        </Pressable>
        {error ? (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <IosErrorBanner>{error}</IosErrorBanner>
          </View>
        ) : null}
        <View style={{ marginHorizontal: 16, marginTop: 16 }}>
          <IosButton variant="blue" onPress={onContinue} disabled={!checked} loading={recordConsent.isPending}>
            Continue
          </IosButton>
        </View>
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: colors.text, fontFamily, marginHorizontal: 16, marginBottom: 12 },
  disclaimer: { fontSize: 12, color: colors.textLight, lineHeight: 18, fontFamily },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginHorizontal: 16, marginTop: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.silver,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: { backgroundColor: colors.blue, borderColor: colors.blue },
  rowText: { flex: 1, fontSize: 13, color: colors.text, fontFamily, lineHeight: 19 },
});
