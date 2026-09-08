import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Bell, MapPin, Clock } from "lucide-react-native";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import { IosPage, IosAppIcon, IosButton, IosCard } from "@/components/ios6";

/**
 * First screen a new install sees.
 *
 * Before this existed, opening the app dropped a first-time user straight onto
 * a bare email + password form: no statement of what TattleTow does, no mention
 * that coverage is Milwaukee-only, nothing to orient them. The store listing
 * did the selling and the app immediately stopped it.
 *
 * DELIBERATELY CARRIES NO PRICE, PLAN, OR PURCHASE CTA. Apple's anti-steering
 * rules bar purchase flows and pricing from inside the native app — that is the
 * reason checkout lives on the web at all. This screen is shared by both
 * platforms, so it is built to the stricter rule. Explaining the product,
 * stating coverage, and routing to sign-up or sign-in is the entire permitted
 * surface, and it is enough. Do not add "$2.99/mo" here.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  const points = [
    {
      icon: Bell,
      title: "Early parking ticket warnings",
      body: "We watch Milwaukee's own parking-complaint records and tell you when one lands near where you parked.",
    },
    {
      icon: Clock,
      title: "Checked every 5 minutes",
      body: "A complaint is filed before enforcement arrives. That gap is the whole point — it's time to go move your car.",
    },
    {
      icon: MapPin,
      title: "Watch the blocks you park on",
      body: "Add the streets that matter to you and get a text, email, or push the moment something is filed nearby.",
    },
  ];

  return (
    <IosPage>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <IosAppIcon gradient={gradients.appIconBlue}>
            <Bell size={40} color="#fff" strokeWidth={2} />
          </IosAppIcon>
          <Text style={styles.wordmark}>TattleTow</Text>
          <Text style={styles.tagline}>Early Parking Ticket Warnings</Text>
        </View>

        <View style={{ gap: 10, marginBottom: 18 }}>
          {points.map((p) => {
            const Icon = p.icon;
            return (
              <IosCard key={p.title} style={styles.point}>
                <View style={styles.pointIcon}>
                  <Icon size={18} color={colors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pointTitle}>{p.title}</Text>
                  <Text style={styles.pointBody}>{p.body}</Text>
                </View>
              </IosCard>
            );
          })}
        </View>

        {/* Coverage stated up front rather than discovered later. No date and no
            named next city on purpose: a soft "coming soon" ages badly. Copy is
            held identical to the web landing page so the two surfaces agree. */}
        <IosCard style={styles.coverage}>
          <Text style={styles.coverageTitle}>Milwaukee first. More cities next.</Text>
          <Text style={styles.coverageBody}>
            TattleTow runs on Milwaukee's own parking-complaint records, and Milwaukee is
            the only city we cover today. Tell us where you park and we'll go there next —
            demand is genuinely how we pick.
          </Text>
        </IosCard>

        <View style={{ gap: 10, marginTop: 20 }}>
          <IosButton variant="blue" onPress={() => router.push("/auth/signup")}>
            Create Account
          </IosButton>
          <IosButton variant="silver" onPress={() => router.push("/auth/login")}>
            Sign In
          </IosButton>
        </View>

        <Text style={styles.disclaimer}>
          TattleTow monitors publicly filed parking complaints and provides informational
          alerts only. We are not affiliated with the City of Milwaukee or any law
          enforcement agency, and an alert does not mean a ticket has been issued.
        </Text>
      </ScrollView>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingTop: 28, paddingBottom: 36 },
  header: { alignItems: "center", marginBottom: 22 },
  wordmark: {
    fontSize: 30, fontWeight: "700", color: colors.text,
    fontFamily, marginTop: 12, letterSpacing: -0.5,
  },
  tagline: { fontSize: 14, color: colors.textLight, fontFamily, marginTop: 4 },
  point: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
  pointIcon: {
    width: 34, height: 34, borderRadius: 8, alignItems: "center",
    justifyContent: "center", backgroundColor: "rgba(0,54,158,0.08)",
  },
  pointTitle: { fontSize: 15, fontWeight: "700", color: colors.text, fontFamily, marginBottom: 2 },
  pointBody: { fontSize: 13, color: colors.textLight, fontFamily, lineHeight: 18 },
  coverage: { padding: 16 },
  coverageTitle: { fontSize: 16, fontWeight: "700", color: colors.text, fontFamily, marginBottom: 6 },
  coverageBody: { fontSize: 13, color: colors.textLight, fontFamily, lineHeight: 19 },
  disclaimer: {
    fontSize: 11, color: colors.textLight, fontFamily,
    lineHeight: 16, textAlign: "center", marginTop: 22,
  },
});
