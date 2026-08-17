import { useState } from "react";
import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Navigation } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, gradients, fontFamily } from "@/lib/ios6-theme";
import { SERVICE_AREAS, ServiceArea, findServiceArea } from "@/lib/supported-locations";
import { ReverseGeocodeResult } from "@/lib/geocode";
import { AddressMapPicker } from "@/components/AddressMapPicker";
import {
  IosPage,
  IosNavBar,
  IosSectionLabel,
  IosZoneTile,
  IosCard,
  IosButton,
  IosInput,
  IosServiceAreaPicker,
  IosDisclaimerModal,
} from "@/components/ios6";

const emptyZoneDraft = {
  houseNumber: "",
  street: "",
  label: "",
  area: SERVICE_AREAS[0] as ServiceArea,
};

export default function WatchZonesScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [showAddZone, setShowAddZone] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [newZone, setNewZone] = useState(emptyZoneDraft);

  const zonesQuery = trpc.zones.list.useQuery();

  const createZone = trpc.zones.create.useMutation({
    onSuccess: () => {
      utils.zones.list.invalidate();
      setShowAddZone(false);
      setNewZone(emptyZoneDraft);
      setShowDisclaimer(true);
    },
    onError: (err: any) => Alert.alert("Error", err.message || "Could not add zone."),
  });

  const deleteZone = trpc.zones.delete.useMutation({
    onSuccess: () => utils.zones.list.invalidate(),
    onError: (err: any) => Alert.alert("Error", err.message || "Could not remove zone."),
  });

  const logInterest = trpc.serviceArea.logInterest.useMutation();

  const handleAddZone = () => {
    if (!newZone.street.trim() || !newZone.houseNumber) {
      Alert.alert("Missing info", "House number and street are required.");
      return;
    }
    createZone.mutate({
      street: newZone.street.trim(),
      centerAddress: Number(newZone.houseNumber),
      label: newZone.label.trim() || undefined,
      city: newZone.area.city,
      state: newZone.area.state,
    });
  };

  const handleMapConfirm = (result: ReverseGeocodeResult) => {
    setShowMap(false);
    const area = result.city && result.state ? findServiceArea(result.city, result.state) : undefined;

    if (!area) {
      logInterest.mutate({
        city: result.city || undefined,
        state: result.state || undefined,
        displayName: result.displayName || undefined,
        lat: result.lat,
        lng: result.lng,
      });
      Alert.alert(
        "Outside of Service Area",
        "TKTAlert doesn't cover that location yet — Coming Soon! We've logged your interest to help us prioritize where to expand next."
      );
      return;
    }

    setShowAddZone(true);
    setNewZone((z) => ({
      ...z,
      houseNumber: result.houseNumber || z.houseNumber,
      street: result.street || z.street,
      area,
    }));
  };

  const handleDeleteZone = (zoneId: number, label: string) => {
    Alert.alert("Remove Zone", `Stop monitoring ${label}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteZone.mutate({ zoneId }) },
    ]);
  };

  const zones = zonesQuery.data ?? [];
  const tileGradients = [gradients.iconBlue, gradients.iconGreen] as const;

  return (
    <IosPage>
      <IosNavBar title="Manage Zones" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <IosSectionLabel>Your Watch Zones</IosSectionLabel>

        {zones.length > 0 ? (
          <View style={styles.tileRow}>
            {zones.map((zone: any, i: number) => (
              <IosZoneTile
                key={zone.id}
                label={zone.label ?? zone.street}
                street={zone.street}
                addressRange={`${zone.addressMin}–${zone.addressMax}`}
                gradient={tileGradients[i % tileGradients.length]}
                onDelete={() => handleDeleteZone(zone.id, zone.label ?? zone.street)}
              />
            ))}
          </View>
        ) : (
          <IosCard style={styles.emptyZones}>
            <Text style={styles.emptyZonesText}>No watch zones yet</Text>
            <Text style={styles.emptyZonesSubtext}>Add an address below to start getting alerts.</Text>
          </IosCard>
        )}

        {zones.length < 2 && !showAddZone && (
          <View style={{ marginTop: 16 }}>
            <IosButton variant="silver" onPress={() => setShowAddZone(true)}>
              + Add Watch Zone
            </IosButton>
          </View>
        )}

        {showAddZone && (
          <IosCard style={{ marginTop: 16, padding: 16 }}>
            <Text style={styles.addZoneTitle}>New Watch Zone</Text>

            <View style={{ marginBottom: 14 }}>
              <IosButton variant="blue" onPress={() => setShowMap(true)}>
                <View style={styles.addZoneBtnContent}>
                  <Navigation size={16} color="#fff" />
                  <Text style={[styles.addZoneBtnText, { color: "#fff" }]}>Locate on Map</Text>
                </View>
              </IosButton>
              <Text style={styles.orDivider}>or enter it manually</Text>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={styles.fieldLabel}>House Number</Text>
                <IosInput
                  placeholder="e.g. 1234"
                  keyboardType="number-pad"
                  value={newZone.houseNumber}
                  onChangeText={(v) => setNewZone((z) => ({ ...z, houseNumber: v }))}
                  textContentType="none"
                  autoComplete="off"
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Street Name</Text>
                <IosInput
                  placeholder="e.g. N Milwaukee St"
                  value={newZone.street}
                  onChangeText={(v) => setNewZone((z) => ({ ...z, street: v }))}
                  textContentType="none"
                  autoComplete="off"
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Service Area</Text>
                <IosServiceAreaPicker value={newZone.area} onChange={(area) => setNewZone((z) => ({ ...z, area }))} />
              </View>
              <View>
                <Text style={styles.fieldLabel}>Label (optional)</Text>
                <IosInput
                  placeholder="e.g. Work parking"
                  value={newZone.label}
                  onChangeText={(v) => setNewZone((z) => ({ ...z, label: v }))}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <IosButton
                  variant="silver"
                  flex={1}
                  onPress={() => {
                    setShowAddZone(false);
                    setNewZone(emptyZoneDraft);
                  }}
                >
                  Cancel
                </IosButton>
                <IosButton variant="blue" flex={2} onPress={handleAddZone} loading={createZone.isPending}>
                  Add Zone
                </IosButton>
              </View>
            </View>
          </IosCard>
        )}
      </ScrollView>

      <AddressMapPicker visible={showMap} onClose={() => setShowMap(false)} onConfirm={handleMapConfirm} />
      <IosDisclaimerModal visible={showDisclaimer} onClose={() => setShowDisclaimer(false)} />
    </IosPage>
  );
}

const styles = StyleSheet.create({
  tileRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  emptyZones: { alignItems: "center", paddingVertical: 24, gap: 4 },
  emptyZonesText: { fontSize: 14, fontWeight: "600", color: colors.text, fontFamily },
  emptyZonesSubtext: { fontSize: 12, color: colors.textLight, fontFamily },
  addZoneTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 14, fontFamily },
  addZoneBtnContent: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  addZoneBtnText: { fontSize: 15, fontWeight: "700", color: colors.blue, fontFamily },
  orDivider: { fontSize: 12, color: colors.textLight, textAlign: "center", marginTop: 8, fontFamily },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.textLight, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4, fontFamily },
});
