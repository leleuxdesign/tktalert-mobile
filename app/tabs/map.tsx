import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  AppState,
  LayoutAnimation,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { keepPreviousData } from "@tanstack/react-query";
import { Bell, ChevronRight, LocateFixed, Lock } from "lucide-react-native";
import { trpc } from "@/lib/trpc";
import { useCheckout } from "@/lib/useCheckout";
import { colors, fontFamily, cardShadow, btnShadow } from "@/lib/ios6-theme";
import { DEFAULT_MAP_CENTER } from "@/lib/supported-locations";
import type { HeatBlock } from "@/lib/router-types";
import { IosNavBar, IosPage, IosSegmented, IosSegment } from "@/components/ios6";
import { TattleHeatMap, TattleHeatMapHandle, MapView } from "@/components/TattleHeatMap";

type Days = 30 | 90 | 365;
type Mode = "complaints" | "tickets";

const COLLAPSED_ROWS = 3;
const EXPANDED_ROWS = 25;

const RANGE_SEGMENTS: IosSegment<"30" | "90" | "365">[] = [
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "365", label: "1 year" },
];

function unitLabel(mode: Mode, n: number) {
  if (mode === "tickets") return n === 1 ? "ticket" : "tickets";
  return n === 1 ? "complaint" : "complaints";
}

function inView(b: HeatBlock, view: MapView | null) {
  if (!view) return true;
  const { north, south, east, west } = view.bounds;
  return b.lat <= north && b.lat >= south && b.lng <= east && b.lng >= west;
}

/** Squared equirectangular distance: only used to break ties, so no sqrt/haversine. */
function distance2(b: HeatBlock, c: { lat: number; lng: number }) {
  const dx = (b.lng - c.lng) * Math.cos((c.lat * Math.PI) / 180);
  const dy = b.lat - c.lat;
  return dx * dx + dy * dy;
}

export default function TattleMapScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<TattleHeatMapHandle>(null);
  const [days, setDays] = useState<Days>(30);
  const [mode, setMode] = useState<Mode>("complaints");
  const [view, setView] = useState<MapView | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const { startCheckout, isPending: checkoutPending } = useCheckout();

  const accessQuery = trpc.map.access.useQuery();
  const access = accessQuery.data;
  const isPaid = access?.tier === "paid";
  const isFree = access?.tier === "free";

  // Coming back from Stripe checkout: pick up the new tier without a pull.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") accessQuery.refetch();
    });
    return () => sub.remove();
  }, []);

  const complaintQuery = trpc.map.complaintHeat.useQuery(
    // The whole city at once (server caches it hourly); the card filters to the
    // viewport locally, so panning never waits on the network.
    { days, limit: 2000 },
    { staleTime: 10 * 60 * 1000, placeholderData: keepPreviousData }
  );

  // Only a paid account may ask; free accounts would get FORBIDDEN.
  const ticketQuery = trpc.map.ticketHeat.useQuery(
    { days },
    {
      enabled: isPaid && access?.ticketMap === true,
      retry: false,
      staleTime: 10 * 60 * 1000,
      placeholderData: keepPreviousData,
    }
  );
  const ticketsAvailable = isPaid && ticketQuery.data?.available === true;

  // The ticket map is an optional per-city extra and must never show up as an
  // empty feature. A paid account sees Tickets only when the server has data.
  // A free account sees it locked, but ONLY when ticket data exists for the
  // city; `map.access` does not tell a free account that yet (see
  // `ticketDataAvailable` in lib/router-types.ts), so until it does the locked
  // segment stays hidden rather than upselling a map with nothing on it.
  const showLockedTickets = isFree && access?.ticketDataAvailable === true;
  const showTicketsSegment = ticketsAvailable || showLockedTickets;

  useEffect(() => {
    if (mode === "tickets" && !ticketsAvailable) setMode("complaints");
  }, [mode, ticketsAvailable]);

  const activeQuery = mode === "tickets" ? ticketQuery : complaintQuery;
  const blocks: HeatBlock[] = activeQuery.data?.blocks ?? [];

  const nearby = useMemo(() => {
    const visible = blocks.filter((b) => inView(b, view));
    const center = view?.center ?? DEFAULT_MAP_CENTER;
    return visible
      .sort((a, b) => b.count - a.count || distance2(a, center) - distance2(b, center))
      .slice(0, EXPANDED_ROWS);
  }, [blocks, view]);

  const rows = expanded ? nearby : nearby.slice(0, COLLAPSED_ROWS);

  const setCardExpanded = (next: boolean) => {
    if (next === expanded) return;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
    setExpanded(next);
  };

  // Swipe the card's handle area up to expand, down to collapse.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -24 && !expandedRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
          setExpanded(true);
        } else if (g.dy > 24 && expandedRef.current) {
          LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
          setExpanded(false);
        }
      },
    })
  ).current;

  const onSegment = (key: Mode) => {
    if (key === "tickets" && !ticketsAvailable) {
      Alert.alert(
        "Ticket map",
        "The parking ticket map is part of a TattleTow subscription, along with real-time complaint alerts.",
        [
          { text: "Not Now", style: "cancel" },
          { text: "Subscribe", onPress: startCheckout },
        ]
      );
      return;
    }
    setMode(key);
  };

  const modeSegments: IosSegment<Mode>[] = [
    { key: "complaints", label: "Complaints" },
    {
      key: "tickets",
      label: "Tickets",
      locked: !ticketsAvailable,
      icon: ticketsAvailable ? undefined : <Lock size={12} color={colors.textLight} strokeWidth={2.5} />,
    },
  ];

  const onRowPress = (b: HeatBlock) => {
    mapRef.current?.flyTo(b.lat, b.lng, 17);
    setCardExpanded(false);
  };

  const footnote =
    mode === "tickets"
      ? "Historical City of Milwaukee parking tickets, by block. The most recent 72 hours are not shown."
      : "Historical City of Milwaukee parking complaints, by block. The most recent 72 hours are not shown.";

  const renderList = () => {
    if (activeQuery.isLoading) {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.blue} />
        </View>
      );
    }
    if (activeQuery.isError) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Couldn't load the map data.</Text>
          <Text style={styles.link} onPress={() => activeQuery.refetch()}>
            Try again
          </Text>
        </View>
      );
    }
    if (blocks.length === 0) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>
            Not enough {mode === "tickets" ? "tickets" : "complaints"} in this period to show a block.
            {days !== 365 ? " Try a longer range." : ""}
          </Text>
        </View>
      );
    }
    if (nearby.length === 0) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>No hotspots in this part of the map. Zoom out or move the map.</Text>
        </View>
      );
    }
    const list = rows.map((b, i) => (
      <Pressable
        key={b.blockKey}
        onPress={() => onRowPress(b)}
        style={({ pressed }) => [
          styles.row,
          i < rows.length - 1 && styles.rowBorder,
          pressed && { backgroundColor: "#e4e3de" },
        ]}
      >
        <View style={[styles.rank, i < 3 && styles.rankHot]}>
          <Text style={[styles.rankText, i < 3 && { color: "#fff" }]}>{i + 1}</Text>
        </View>
        <Text style={styles.rowText} numberOfLines={2}>
          <Text style={styles.rowLabel}>{b.label}</Text>
          <Text style={styles.rowCount}>
            {" · "}
            {b.count} {unitLabel(mode, b.count)}
          </Text>
        </Text>
        <ChevronRight size={16} color={colors.silver} />
      </Pressable>
    ));
    return expanded ? (
      <ScrollView style={{ maxHeight: windowHeight * 0.42 }} nestedScrollEnabled>
        {list}
      </ScrollView>
    ) : (
      <View>{list}</View>
    );
  };

  return (
    <IosPage>
      <IosNavBar title="Tattle Map" />
      <View style={styles.body}>
        <TattleHeatMap
          key={mapKey}
          ref={mapRef}
          blocks={blocks}
          unit={mode}
          onViewChange={setView}
          onLoadError={() => setMapFailed(true)}
        />

        {mapFailed && (
          <View style={styles.mapError}>
            <Text style={styles.stateText}>The map couldn't load. Check your connection.</Text>
            <Text
              style={styles.link}
              onPress={() => {
                setMapFailed(false);
                setMapKey((k) => k + 1);
              }}
            >
              Reload map
            </Text>
          </View>
        )}

        <View style={styles.topOverlay} pointerEvents="box-none">
          {showTicketsSegment ? (
            <IosSegmented segments={modeSegments} value={mode} onChange={onSegment} style={styles.modeControl} />
          ) : (
            <View />
          )}
          <Pressable
            onPress={() => mapRef.current?.flyTo(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, 12)}
            accessibilityLabel="Recenter on Milwaukee"
            hitSlop={6}
            style={({ pressed }) => [styles.recenter, btnShadow, pressed && { opacity: 0.7 }]}
          >
            <LocateFixed size={18} color={colors.blue} />
          </Pressable>
        </View>

        <View style={[styles.card, cardShadow]}>
          <View {...pan.panHandlers}>
            <Pressable
              onPress={() => setCardExpanded(!expanded)}
              accessibilityRole="button"
              accessibilityLabel={expanded ? "Collapse hotspot list" : "Expand hotspot list"}
              style={styles.handleArea}
            >
              <View style={styles.handle} />
            </Pressable>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {mode === "tickets" ? "Ticket hotspots" : "Complaint hotspots"}
              </Text>
              {activeQuery.isFetching && !activeQuery.isLoading ? (
                <ActivityIndicator size="small" color={colors.textLight} />
              ) : (
                <Text style={styles.cardSubtitle}>near map centre</Text>
              )}
            </View>
            <IosSegmented
              compact
              segments={RANGE_SEGMENTS}
              value={String(days) as "30" | "90" | "365"}
              onChange={(k) => setDays(Number(k) as Days)}
              style={styles.rangeControl}
            />
          </View>

          <View style={styles.list}>{renderList()}</View>

          {isFree && (
            <Pressable
              onPress={startCheckout}
              style={({ pressed }) => [styles.upsell, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Bell size={15} color={colors.blue} />
              <Text style={styles.upsellText} numberOfLines={2}>
                Get alerts when someone tattles on your block
              </Text>
              {checkoutPending ? (
                <ActivityIndicator size="small" color={colors.blue} />
              ) : (
                <ChevronRight size={16} color={colors.blue} />
              )}
            </Pressable>
          )}

          <Text style={styles.footnote}>{footnote}</Text>
        </View>
      </View>
    </IosPage>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: colors.background },
  topOverlay: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modeControl: { flex: 1, maxWidth: 260 },
  recenter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(250,250,248,0.96)",
    borderWidth: 1,
    borderColor: colors.separator,
    alignItems: "center",
    justifyContent: "center",
  },
  mapError: {
    position: "absolute",
    top: "30%",
    left: 24,
    right: 24,
    alignItems: "center",
    gap: 6,
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  card: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(245,244,240,0.97)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  handleArea: { alignItems: "center", paddingTop: 7, paddingBottom: 6 },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: colors.chrome },
  cardHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text, fontFamily },
  cardSubtitle: { fontSize: 12, color: colors.textLight, fontFamily },
  rangeControl: { marginBottom: 8 },
  list: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, minHeight: 44 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#e0dfd8" },
  rank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8e8ed",
  },
  rankHot: { backgroundColor: colors.red },
  rankText: { fontSize: 11, fontWeight: "700", color: colors.textLight, fontFamily },
  rowText: { flex: 1, fontFamily },
  rowLabel: { fontSize: 14, fontWeight: "600", color: colors.text, fontFamily },
  rowCount: { fontSize: 13, color: colors.textLight, fontFamily },
  stateBox: { alignItems: "center", gap: 6, paddingVertical: 16, paddingHorizontal: 12 },
  stateText: { fontSize: 13, color: colors.textLight, fontFamily, textAlign: "center", lineHeight: 18 },
  link: { fontSize: 14, fontWeight: "700", color: colors.blue, fontFamily },
  upsell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#eaf3fc",
    borderWidth: 1,
    borderColor: "#b8d9f5",
  },
  upsellText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.blueDark, fontFamily },
  footnote: { fontSize: 10.5, color: colors.textLight, fontFamily, textAlign: "center", marginTop: 8, lineHeight: 14 },
});
