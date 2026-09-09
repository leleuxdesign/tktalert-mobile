import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Check, AlertTriangle } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { colors, fontFamily } from "@/lib/ios6-theme";
import { IosInput } from "@/components/ios6";

/**
 * Street entry with suggestions from the City of Milwaukee's official street list.
 *
 * Why a picker and not just a text field: zone matching is exact string equality
 * on the canonicalized street name, so "N Marshal St" — one missing letter —
 * creates a zone that silently never fires. No error, no alert, no way for the
 * user to tell. Half of all production zones were dead this way.
 *
 * Why typing still works: the city list is authoritative but the user's
 * judgement outranks it, and hard-blocking an unrecognised street would trade a
 * silent failure for a loud false rejection. Free text is allowed and warned about.
 */
export function StreetPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (street: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);

  const { data: matches } = trpc.streets.search.useQuery(
    { q: value },
    { enabled: value.trim().length >= 2, staleTime: 60_000 }
  );

  const list: { label: string; addressMin: number; addressMax: number; exact?: boolean }[] =
    matches ?? [];
  // Server-decided, using the same normalizeStreet the scanner matches on.
  // A raw compare warned about "West Pierce Street" — valid, just spelled out
  // where the city list abbreviates.
  const exact = list.some((m: any) => m.exact);
  const showList = focused && list.length > 0 && !exact;
  const showWarning =
    touched && !focused && value.trim().length >= 2 && !exact && matches !== undefined;

  return (
    <View>
      <IosInput
        placeholder="Start typing, e.g. Marshall"
        value={value}
        onChangeText={(v) => {
          onChange(v);
          setTouched(true);
        }}
        onFocus={() => setFocused(true)}
        // Delayed so a tap on a suggestion registers before the list unmounts.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        textContentType="none"
        autoComplete="off"
        autoCorrect={false}
      />

      {showList && (
        <View style={styles.list}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 190 }}>
            {list.map((m) => (
              <Pressable
                key={m.label}
                onPress={() => {
                  onChange(m.label);
                  setFocused(false);
                }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.rowLabel}>{m.label}</Text>
                <Text style={styles.rowSub}>
                  addresses {m.addressMin}–{m.addressMax}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {exact && !focused && (
        <View style={styles.noteRow}>
          <Check size={12} color={colors.green} />
          <Text style={[styles.note, { color: colors.green }]}>
            Matches a City of Milwaukee street
          </Text>
        </View>
      )}

      {showWarning && (
        <View style={styles.noteRow}>
          <AlertTriangle size={12} color={colors.orange} />
          <Text style={[styles.note, { color: colors.orange, flex: 1 }]}>
            We don't recognise this street. You can still add it, but alerts only fire on
            an exact match — a typo or a missing N/S/E/W means this zone will never notify
            you.
            {list.length > 0 ? ` Did you mean ${list[0].label}?` : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  row: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  rowLabel: { fontSize: 14, fontWeight: "600", color: colors.text, fontFamily },
  rowSub: { fontSize: 11, color: colors.textLight, fontFamily, marginTop: 1 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 5 },
  note: { fontSize: 11, fontFamily, lineHeight: 15 },
});
