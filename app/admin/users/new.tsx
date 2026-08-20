import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import { SERVICE_AREAS, ServiceArea } from "@/lib/supported-locations";
import {
  IosPage,
  IosNavBar,
  IosAppIcon,
  IosCard,
  IosInput,
  IosButton,
  IosErrorBanner,
  IosServiceAreaPicker,
} from "@/components/ios6";

export default function AdminNewUserScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState<ServiceArea>(SERVICE_AREAS[0]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const createUser = trpc.adminUsers.create.useMutation({
    onSuccess: (data: any) => {
      utils.adminUsers.list.invalidate();
      setResult({ email, temporaryPassword: data.temporaryPassword });
    },
    onError: (err: any) => setError(err.message || "Could not create user."),
  });

  const handleSubmit = () => {
    setError("");
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    createUser.mutate({
      email: email.trim(),
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      city: area.city,
    });
  };

  if (result) {
    return (
      <IosPage>
        <IosNavBar title="User Created" />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 32 }}>
          <IosAppIcon size={64} gradient={gradients.appIconBlue}>
            <UserPlus size={30} color="#fff" strokeWidth={2} />
          </IosAppIcon>
          <Text style={styles.successTitle}>Account Created</Text>
          <IosCard style={{ padding: 16, marginTop: 20 }}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text selectable style={styles.credentialValue}>
              {result.email}
            </Text>
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Temporary Password</Text>
            <Text selectable style={styles.credentialValue}>
              {result.temporaryPassword}
            </Text>
          </IosCard>
          <Text style={styles.hintText}>
            Share these credentials with the user directly — this password is shown only once and isn't
            saved anywhere. They should change it after signing in.
          </Text>
          <View style={{ marginTop: 20 }}>
            <IosButton variant="blue" onPress={() => router.replace("/admin/users")}>
              Done
            </IosButton>
          </View>
        </ScrollView>
      </IosPage>
    );
  }

  return (
    <IosPage>
      <IosNavBar title="Add User" onBack={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <View>
            <Text style={styles.fieldLabel}>Email *</Text>
            <IosInput
              placeholder="user@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Name</Text>
            <IosInput placeholder="Jane Doe" value={name} onChangeText={setName} />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Phone</Text>
            <IosInput placeholder="(414) 555-0000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          <View>
            <Text style={styles.fieldLabel}>City</Text>
            <IosServiceAreaPicker value={area} onChange={setArea} />
          </View>
        </View>

        {error ? <View style={{ marginTop: 12 }}><IosErrorBanner>{error}</IosErrorBanner></View> : null}

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <IosButton variant="blue" onPress={handleSubmit} loading={createUser.isPending}>
            Create Account
          </IosButton>
          <Text style={styles.hintText}>
            New accounts are created as comped (free access) with no trial expiration.
          </Text>
        </View>
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
    fontFamily,
  },
  successTitle: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center", marginTop: 14, fontFamily },
  credentialValue: { fontSize: 17, fontWeight: "600", color: colors.text, fontFamily },
  hintText: { fontSize: 12, color: colors.textLight, textAlign: "center", marginTop: 14, lineHeight: 17, fontFamily },
});
