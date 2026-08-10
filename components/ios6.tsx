import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { ChevronLeft, ChevronRight, Pencil, Check, X, MapPin } from "lucide-react-native";
import { colors, gradients, fontFamily, cardShadow, btnShadow, navShadow } from "@/lib/ios6-theme";
import { SERVICE_AREAS, ServiceArea } from "@/lib/supported-locations";

// ── Nav Bar ──────────────────────────────────────────────────────────────
export function IosNavBar({
  title,
  onBack,
  backLabel = "Back",
  right,
}: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <LinearGradient colors={gradients.navbar} style={[styles.navbar, navShadow]}>
      <View style={styles.navSide}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.backBtnWrap}>
            <LinearGradient colors={gradients.backBtn} style={styles.backBtn}>
              <ChevronLeft size={14} color="#fff" strokeWidth={3} style={{ marginLeft: -4 }} />
              <Text style={styles.backBtnText}>{backLabel}</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
      <View style={[styles.navSide, { alignItems: "flex-end" }]}>{right}</View>
    </LinearGradient>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────
type BtnVariant = "blue" | "green" | "red" | "silver";
const btnGradients: Record<BtnVariant, readonly string[]> = {
  blue: gradients.btnBlue,
  green: gradients.btnGreen,
  red: gradients.btnRed,
  silver: gradients.btnSilver,
};
const btnTextColor: Record<BtnVariant, string> = {
  blue: "#fff",
  green: "#fff",
  red: "#fff",
  silver: colors.text,
};
const btnBorderColor: Record<BtnVariant, string> = {
  blue: "#0a4f90",
  green: "#1d9933",
  red: "#aa1008",
  silver: "#9a9a9f",
};

export function IosButton({
  variant = "blue",
  onPress,
  children,
  disabled,
  loading,
  style,
  flex,
}: {
  variant?: BtnVariant;
  onPress?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { opacity: disabled ? 0.6 : pressed ? 0.85 : 1, flex },
        style,
      ]}
    >
      <LinearGradient
        colors={btnGradients[variant] as any}
        style={[styles.btn, btnShadow, { borderColor: btnBorderColor[variant] }]}
      >
        {loading ? (
          <ActivityIndicator color={btnTextColor[variant]} />
        ) : typeof children === "string" ? (
          <Text style={[styles.btnText, { color: btnTextColor[variant] }]}>{children}</Text>
        ) : (
          children
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ── Inputs ───────────────────────────────────────────────────────────────
export function IosInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.silver}
      style={[styles.input, props.style]}
      {...props}
    />
  );
}

export function IosFormCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.formCard, style]}>{children}</View>;
}

export function IosFormRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return <View style={[styles.formRow, last && { borderBottomWidth: 0 }]}>{children}</View>;
}

export function IosFormLabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.formLabelRow}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Locked field (email/phone): shows as text + Edit pill until tapped ────
export function IosLockedField({
  label,
  value,
  placeholder,
  onSave,
  saving,
  keyboardType,
  startEditing,
  formatDisplay,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (next: string) => void;
  saving?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  startEditing?: boolean;
  formatDisplay?: (value: string) => string;
}) {
  const [editing, setEditing] = useState(!!startEditing);
  const [draft, setDraft] = useState(value);

  const beginEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const confirm = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  return (
    <View>
      <Text style={styles.formLabel}>{label}</Text>
      {editing ? (
        <View style={styles.lockedRow}>
          <IosInput
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoFocus={!startEditing}
            style={{ flex: 1 }}
          />
          <Pressable onPress={confirm} disabled={saving} style={styles.lockedIconBtn} hitSlop={6}>
            {saving ? <ActivityIndicator size="small" color={colors.blue} /> : <Check size={18} color={colors.green} />}
          </Pressable>
          <Pressable onPress={cancel} disabled={saving} style={styles.lockedIconBtn} hitSlop={6}>
            <X size={18} color={colors.red} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.lockedRow}>
          <Text style={styles.lockedValue} numberOfLines={1}>
            {value ? (formatDisplay ? formatDisplay(value) : value) : placeholder || "—"}
          </Text>
          <Pressable onPress={beginEdit} style={styles.editPill} hitSlop={6}>
            <Pencil size={12} color={colors.blue} />
            <Text style={styles.editPillText}>Edit</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Service area picker (wheel sheet, iOS6 style) — a single combined
// city/state selector rather than separate city text + state dropdown ────
export function IosServiceAreaPicker({
  value,
  onChange,
}: {
  value: ServiceArea | undefined;
  onChange: (area: ServiceArea) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState<string>(value?.label ?? SERVICE_AREAS[0].label);

  return (
    <>
      <Pressable
        onPress={() => {
          setDraftLabel(value?.label ?? SERVICE_AREAS[0].label);
          setOpen(true);
        }}
      >
        <View pointerEvents="none">
          <IosInput value={value?.label ?? ""} placeholder="Select service area" editable={false} />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerToolbar}>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.pickerCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const area = SERVICE_AREAS.find((a) => a.label === draftLabel) ?? SERVICE_AREAS[0];
                  onChange(area);
                  setOpen(false);
                }}
                hitSlop={8}
              >
                <Text style={styles.pickerDone}>Done</Text>
              </Pressable>
            </View>
            <Picker selectedValue={draftLabel} onValueChange={(v) => setDraftLabel(String(v))}>
              {SERVICE_AREAS.map((a) => (
                <Picker.Item key={a.label} label={a.label} value={a.label} />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Zone tile — square glossy iOS-icon-style tile with a classic iOS
// "wiggle mode" delete badge in the top-left corner ───────────────────────
export function IosZoneTile({
  label,
  street,
  addressRange,
  gradient = gradients.iconBlue,
  onPress,
  onDelete,
}: {
  label: string;
  street?: string;
  addressRange: string;
  gradient?: readonly string[];
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const showStreetLine = !!street && street !== label;
  return (
    <View style={styles.zoneTileWrap}>
      <Pressable onPress={onPress} style={styles.zoneTile}>
        <LinearGradient colors={gradient as any} style={styles.zoneTileGradient}>
          <LinearGradient colors={gradients.glossHighlight as any} style={styles.zoneTileGloss} />
          <MapPin size={26} color="#fff" strokeWidth={2} />
          <Text style={styles.zoneTileLabel} numberOfLines={1}>
            {label}
          </Text>
          {showStreetLine ? (
            <Text style={styles.zoneTileStreet} numberOfLines={1}>
              {street}
            </Text>
          ) : null}
          <Text style={styles.zoneTileSublabel} numberOfLines={1}>
            {addressRange}
          </Text>
        </LinearGradient>
      </Pressable>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} style={styles.zoneTileBadge}>
          <X size={11} color="#fff" strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Shadow-boxed field (used for account details instead of bare text) ───
export function IosShadowField({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.shadowField, cardShadow, style]}>{children}</View>;
}

// ── Card / Stat Card ─────────────────────────────────────────────────────
export function IosCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={gradients.card as any} style={[styles.card, cardShadow, style]}>
      {children}
    </LinearGradient>
  );
}

export function IosStatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <IosCard style={{ flex: 1, alignItems: "center", paddingVertical: 10, paddingHorizontal: 8 }}>
      <Text style={styles.statLabel}>{label}</Text>
      {typeof value === "string" ? <Text style={styles.statValue}>{value}</Text> : value}
    </IosCard>
  );
}

// ── Table ────────────────────────────────────────────────────────────────
export function IosTable({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.table, cardShadow, style]}>{children}</View>;
}

export function IosTableRow({
  onPress,
  children,
  last,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }: any) => [
        styles.tableRow,
        !last && styles.tableRowBorder,
        pressed && onPress ? { backgroundColor: "#d4d4d8" } : null,
        style,
      ]}
    >
      {children}
    </Wrapper>
  );
}

export function IosTableRowLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.tableRowLabel}>{children}</Text>;
}

export function IosChevron() {
  return <ChevronRight size={18} color={colors.silver} />;
}

// ── Small icon-only action button (e.g. a compact delete affordance) ─────
export function IosIconButton({
  onPress,
  children,
  color = colors.red,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.iconBtn, { borderColor: color + "33" }, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}

export function IosSectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// ── Icon cell (colored squircle used in table rows) ─────────────────────
export function IosIconCell({
  gradient = gradients.iconBlue,
  children,
}: {
  gradient?: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <LinearGradient colors={gradient as any} style={styles.iconCell}>
      {children}
    </LinearGradient>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────
export function IosBadge({
  gradient = gradients.badgeBlue,
  children,
  textColor = "#fff",
}: {
  gradient?: readonly string[];
  children: React.ReactNode;
  textColor?: string;
}) {
  return (
    <LinearGradient colors={gradient as any} style={styles.badge}>
      <Text style={[styles.badgeText, { color: textColor }]}>{children}</Text>
    </LinearGradient>
  );
}

// ── Big glossy app icon (login logo, success checkmark) ──────────────────
export function IosAppIcon({
  size = 80,
  gradient = gradients.appIconBlue,
  children,
}: {
  size?: number;
  gradient?: readonly string[];
  children: React.ReactNode;
}) {
  const radius = size * 0.225;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        ...btnShadow,
        alignSelf: "center",
      }}
    >
      <LinearGradient
        colors={gradient as any}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <LinearGradient
          colors={gradients.glossHighlight as any}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%" }}
        />
        {children}
      </LinearGradient>
    </View>
  );
}

// ── Step dots (signup wizard progress) ────────────────────────────────────
export function IosStepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.stepDot, i + 1 === current && { backgroundColor: colors.blue }]}
        />
      ))}
    </View>
  );
}

// ── Error banner ────────────────────────────────────────────────────────
export function IosErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{children}</Text>
    </View>
  );
}

// ── Page wrapper ─────────────────────────────────────────────────────────
export function IosPage({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={["top"]} style={[styles.page, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  navbar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#3a4455",
  },
  navSide: { minWidth: 60, justifyContent: "center" },
  navTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    fontFamily,
  },
  backBtnWrap: { alignSelf: "flex-start" },
  backBtn: {
    height: 30,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: "#1a4f84",
  },
  backBtnText: { color: "#fff", fontSize: 12, fontWeight: "700", fontFamily },
  btn: {
    height: 44,
    borderRadius: radiiMd(),
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
  },
  btnText: { fontSize: 17, fontWeight: "700", fontFamily },
  input: {
    width: "100%",
    height: 44,
    paddingHorizontal: 12,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 10,
    fontFamily,
  },
  formCard: {
    backgroundColor: "#fafaf8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    marginHorizontal: 16,
    overflow: "hidden",
    ...cardShadow,
  },
  formRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#e0dfd8",
  },
  formLabelRow: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
    fontFamily,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    overflow: "hidden",
  },
  statLabel: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 4,
    fontFamily,
  },
  statValue: { fontSize: 16, fontWeight: "700", color: colors.text, fontFamily },
  table: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
    gap: 12,
  },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  tableRowLabel: { fontSize: 17, color: colors.text, flex: 1, fontFamily },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textLight,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    paddingLeft: 4,
    fontFamily,
  },
  iconCell: {
    width: 29,
    height: 29,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "700", fontFamily },
  stepDots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.separator },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff2f2",
    borderWidth: 1,
    borderColor: "#ffb3b3",
    borderRadius: 8,
  },
  errorBannerText: { fontSize: 14, color: "#c0392b", fontFamily, textAlign: "center" },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  lockedValue: { flex: 1, fontSize: 15, color: colors.text, fontFamily, paddingVertical: 10 },
  editPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#eaf3fc",
    borderWidth: 1,
    borderColor: "#b8d9f5",
  },
  editPillText: { fontSize: 12, fontWeight: "700", color: colors.blue, fontFamily },
  lockedIconBtn: { padding: 6 },
  pickerOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: { backgroundColor: colors.white, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingBottom: 20 },
  pickerToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  pickerCancel: { fontSize: 16, color: colors.textLight, fontFamily },
  pickerDone: { fontSize: 16, color: colors.blue, fontWeight: "700", fontFamily },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
  },
  zoneTileWrap: { position: "relative" },
  zoneTile: {
    width: 152,
    height: 152,
    borderRadius: 152 * 0.225,
    overflow: "hidden",
    ...btnShadow,
  },
  zoneTileGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    gap: 4,
  },
  zoneTileGloss: { position: "absolute", top: 0, left: 0, right: 0, height: "45%" },
  zoneTileLabel: { fontSize: 15, fontWeight: "700", color: "#fff", fontFamily, marginTop: 6, textAlign: "center" },
  zoneTileStreet: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.95)", fontFamily, textAlign: "center", marginTop: 1 },
  zoneTileSublabel: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontFamily, textAlign: "center", marginTop: 1 },
  zoneTileBadge: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    ...btnShadow,
  },
  shadowField: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 14,
  },
});

function radiiMd() {
  return 10;
}
