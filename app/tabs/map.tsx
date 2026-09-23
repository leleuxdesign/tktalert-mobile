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
import { logAction } from "@/lib/analytics";
import { colors, fontFamily, cardShadow, btnShadow, zoneColor } from "@/lib/ios6-theme";
import { DEFAULT_MAP_CENTER } from "@/lib/supported-locations";
import type { HeatBlock, ZonePin } from "@/lib/router-types";
import { IosNavBar, IosPage, IosSegmented, IosSegment } from "@/components/ios6";
import { TattleHeatMap, TattleHeatMapHandle, MapView, MapZonePin } from "@/components/TattleHeatMap";

type Days = 30 | 90 | 365;
type Mode = "complaints" | "tickets";

const COLLAPSED_ROWS = 3;
/**
 * Truncation: the city-wide request is capped at 2000 blocks, highest counts
 * first, so if the city ever has more, low-count blocks drop off. At street
 * zoom those are exactly the blocks a person is looking at, so once zoomed in
 * this far AND the city-wide answer says `truncated`, the screen also asks for
 * just the surrounding area and merges the two. Bounds are padded and snapped
 * to a grid so small pans reuse the same query (and the server's hourly cache
 * means each one is a cheap filter). While not truncated, which is the normal
 * case for Milwaukee, no extra request is ever made.
 */
const DETAIL_MIN_ZOOM = 14;
const DETAIL_GRID_DEG = 0.02;
const EXPANDED_ROWS = 25;

const RANGE_SEGMENTS: IosSegment<"30" | "90" | "365">[] = [
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "365", label: "1 year" },
];

function snapBounds(b: MapView["bounds"]) {
  const padLat = (b.north - b.south) * 0.5;
  const padLng = (b.east - b.west) * 0.5;
  const down = (n: number) => Math.floor(n / DETAIL_GRID_DEG) * DETAIL_GRID_DEG;
  const up = (n: number) => Math.ceil(n / DETAIL_GRID_DEG) * DETAIL_GRID_DEG;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return {
    north: r(Math.min(90, up(b.north + padLat))),
    south: r(Math.max(-90, down(b.south - padLat))),
    east: r(Math.min(180, up(b.east + padLng))),
    west: r(Math.max(-180, down(b.west - padLng))),
  };
}

function zoneTitle(z: ZonePin) {
  return z.label?.trim() || z.street;
}

/** Popup second line: the block range, with the street when the title is a custom label. */
function zoneRange(z: ZonePin) {
  const range = `${z.blockStart}–${z.blockEnd}`;
  return z.label?.trim() ? `${z.street} · ${range}` : range;
}

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

  // Explicit allow-listed action in addition to the central screen_view.
  useEffect(() => {
    logAction("map_opened");
  }, []);

  // Coming back from Stripe checkout: pick up the new tier without a pull.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        accessQuery.refetch();
        myZonesQuery.refetch();
      }
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
      enabled: isPaid && access?.ticketMap === true && access?.ticketDataAvailable === true,
      retry: false,
      staleTime: 10 * 60 * 1000,
      placeholderData: keepPreviousData,
    }
  );
  const ticketsAvailable = isPaid && ticketQuery.data?.available === true;

  // The ticket map is an optional per-city extra and must never show up as an
  // empty feature. `ticketDataAvailable` (same for every tier) gates the
  // segment: locked for a free account, open for a paid one once ticketHeat
  // actually returns data. Milwaukee: false, so no Tickets segment at all.
  const showLockedTickets = isFree && access?.ticketDataAvailable === true;
  const showTicketsSegment = ticketsAvailable || showLockedTickets;

  useEffect(() => {
    if (mode === "tickets" && !ticketsAvailable) setMode("complaints");
  }, [mode, ticketsAvailable]);

  const detailBounds = useMemo(
    () =>
      complaintQuery.data?.truncated && view && view.zoom >= DETAIL_MIN_ZOOM ? snapBounds(view.bounds) : null,
    [complaintQuery.data?.truncated, view]
  );
  const detailQuery = trpc.map.complaintHeat.useQuery(
    { days, bounds: detailBounds ?? undefined, limit: 2000 },
    { enabled: mode === "complaints" && !!detailBounds, staleTime: 10 * 60 * 1000 }
  );

  const activeQuery = mode === "tickets" ? ticketQuery : complaintQuery;
  const blocks: HeatBlock[] = useMemo(() => {
    const base = activeQuery.data?.blocks ?? [];
    const extra = mode === "complaints" && detailBounds ? detailQuery.data?.blocks ?? [] : [];
    if (extra.length === 0) return base;
    const byKey = new Map<string, HeatBlock>();
    for (const b of base) byKey.set(b.blockKey, b);
    for (const b of extra) byKey.set(b.blockKey, b);
    return Array.from(byKey.values()).sort((a, b) => b.count - a.count);
  }, [activeQuery.data, detailQuery.data, detailBounds, mode]);

  // The user's own zones as pins, free or paid. Unplaceable zones are skipped.
  const myZonesQuery = trpc.map.myZones.useQuery(undefined, { staleTime: 60 * 1000 });
  const placedZones = useMemo(
    () =>
      (myZonesQuery.data ?? []).filter(
        (z): z is ZonePin & { lat: number; lng: number } =>
          typeof z.lat === "number" && typeof z.lng === "number"
      ),
    [myZonesQuery.data]
  );
  const zonePins: MapZonePin[] = useMemo(
    () =>
      placedZones.map((z) => ({
        id: z.id,
        lat: z.lat,
        lng: z.lng,
        color: zoneColor(z.color).solid,
        title: zoneTitle(z),
        subtitle: zoneRange(z),
      })),
    [placedZones]
  );

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
          zones={zonePins}
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
              onChange={(k) => {
                logAction("map_range_changed", k);
                setDays(Number(k) as Days);
              }}
              style={styles.rangeControl}
            />
          </View>

          <View style={styles.list}>{renderList()}</View>

          {placedZones.length > 0 && (
            <View style={styles.zonesSection}>
              <Text style={styles.zonesLabel}>Your zones</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneChips}>
                {placedZones.map((z) => (
                  <Pressable
                    key={z.id}
                    onPress={() => {
                      mapRef.current?.flyTo(z.lat, z.lng, 17);
                      setCardExpanded(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${zoneTitle(z)} on the map`}
                    style={({ pressed }) => [styles.zoneChip, pressed && { opacity: 0.7 }]}
                  >
                    <View style={[styles.zoneDot, { backgroundColor: zoneColor(z.color).solid }]} />
                    <Text style={styles.zoneChipText} numberOfLines={1}>
                      {zoneTitle(z)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {isFree && (
            <Pressable
              onPress={startCheckout}
              style={({ pressed }) => [styles.upsell, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Bell size={15} color={colors.blue} />
              <Text style={styles.upsellText} numberOfLines={2}>
                Get text and email alerts, and more watch zones
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
  zonesSection: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  zonesLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontFamily,
  },
  zoneChips: { gap: 6, paddingRight: 4 },
  zoneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  zoneDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: "#fff", ...btnShadow },
  zoneChipText: { fontSize: 13, fontWeight: "600", color: colors.text, fontFamily, flexShrink: 1 },
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
