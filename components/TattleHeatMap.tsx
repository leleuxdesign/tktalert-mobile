import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { DEFAULT_MAP_CENTER } from "@/lib/supported-locations";
import type { HeatBlock } from "@/lib/router-types";

/**
 * Tattle Map canvas: Leaflet + leaflet.heat inside a WebView.
 *
 * Loaded exactly the way AddressMapPicker loads Leaflet (unpkg CDN, OSM tiles),
 * so this needs no new native module and can ride any future store build.
 *
 * Data never goes in through the HTML: the page is built once and blocks are
 * pushed with injectJavaScript, so switching the time range or segment
 * redraws the heat layer without reloading the map or losing the viewport.
 *
 * Only block-level aggregates (label, anchor, count) ever reach this page.
 */

export type MapView = {
  center: { lat: number; lng: number };
  bounds: { north: number; south: number; east: number; west: number };
  zoom: number;
};

export type TattleHeatMapHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
};

const DEFAULT_ZOOM = 12;

function buildHtml(lat: number, lng: number, zoom: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8e4dc; }
    /* Quiet the basemap so the glow carries the picture. */
    .leaflet-tile-pane { filter: saturate(0.45) brightness(1.04) contrast(0.92); }
    .leaflet-control-attribution { font: 9px "Helvetica Neue", Helvetica, sans-serif; background: rgba(255,255,255,0.6) !important; }
    .leaflet-heatmap-layer { opacity: 0.9; }

    /* Radar pulse on the top blocks in view. */
    .tt-pulse { position: relative; width: 44px; height: 44px; pointer-events: auto; }
    .tt-pulse .ring {
      position: absolute; left: 50%; top: 50%; width: 44px; height: 44px;
      margin: -22px 0 0 -22px; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,59,48,0.35) 0%, rgba(255,59,48,0.12) 55%, rgba(255,59,48,0) 70%);
      border: 1.5px solid rgba(255,59,48,0.55);
      transform: scale(0.2); opacity: 0;
      animation: tt-radar 2.6s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
    }
    .tt-pulse .ring.r2 { animation-delay: 1.3s; }
    .tt-pulse .dot {
      position: absolute; left: 50%; top: 50%; width: 12px; height: 12px;
      margin: -6px 0 0 -6px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #ff8a80, #ff3b30 60%, #c4160c);
      border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.35), 0 0 10px rgba(255,59,48,0.7);
    }
    @keyframes tt-radar {
      0%   { transform: scale(0.2); opacity: 0.9; }
      80%  { opacity: 0.08; }
      100% { transform: scale(1.9); opacity: 0; }
    }
    .leaflet-tooltip.tt-tip {
      font: 600 12px "Helvetica Neue", Helvetica, sans-serif; color: #1a1a1a;
      background: rgba(250,250,248,0.96); border: 1px solid #c8c7cc; border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2); padding: 4px 8px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
  <script>
    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    if (typeof L === 'undefined' || typeof L.heatLayer !== 'function') {
      post({ type: 'error' });
    } else {
      var PULSE_COUNT = 5;
      var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], ${zoom});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      var heat = L.heatLayer([], {
        radius: 26,
        blur: 22,
        minOpacity: 0.28,
        maxZoom: 16,
        gradient: { 0.2: '#5aafff', 0.45: '#ffd060', 0.7: '#ff9500', 1.0: '#ff3b30' },
      }).addTo(map);
      var pulses = L.layerGroup().addTo(map);
      var blocks = [];
      var unit = 'complaints';

      function unitFor(n) { return n === 1 ? unit.replace(/s$/, '') : unit; }

      function drawPulses() {
        pulses.clearLayers();
        var view = map.getBounds();
        var top = [];
        for (var i = 0; i < blocks.length && top.length < PULSE_COUNT; i++) {
          // Blocks arrive sorted by count, so the first in view are the top.
          if (view.contains([blocks[i].lat, blocks[i].lng])) top.push(blocks[i]);
        }
        top.forEach(function (b) {
          var icon = L.divIcon({
            className: '',
            html: '<div class="tt-pulse"><span class="ring"></span><span class="ring r2"></span><span class="dot"></span></div>',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });
          // textContent, never innerHTML, for server-provided labels.
          var tip = document.createElement('span');
          tip.textContent = b.label + ' \\u00b7 ' + b.count + ' ' + unitFor(b.count);
          L.marker([b.lat, b.lng], { icon: icon, keyboard: false })
            .bindTooltip(tip, { className: 'tt-tip', direction: 'top', offset: [0, -14] })
            .addTo(pulses);
        });
      }

      function sendView() {
        var c = map.getCenter();
        var b = map.getBounds();
        post({
          type: 'view',
          center: { lat: c.lat, lng: c.lng },
          bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
          zoom: map.getZoom(),
        });
      }

      window.__tattle = {
        setData: function (payload) {
          blocks = (payload && payload.blocks) || [];
          unit = (payload && payload.unit) || 'complaints';
          // Scale to the 95th percentile so one extreme block can't wash out
          // every other hotspot in the city.
          var counts = blocks.map(function (b) { return b.count; }).sort(function (a, b) { return a - b; });
          var p95 = counts.length ? counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.95))] : 1;
          heat.setOptions({ max: Math.max(1, p95) });
          heat.setLatLngs(blocks.map(function (b) { return [b.lat, b.lng, b.count]; }));
          drawPulses();
        },
        flyTo: function (lat, lng, zoom) {
          map.flyTo([lat, lng], zoom || 17, { duration: 0.8 });
        },
      };

      map.on('moveend', function () { drawPulses(); sendView(); });
      post({ type: 'ready' });
      sendView();
    }
  </script>
</body>
</html>`;
}

export const TattleHeatMap = forwardRef<
  TattleHeatMapHandle,
  {
    blocks: HeatBlock[];
    unit: "complaints" | "tickets";
    onViewChange?: (view: MapView) => void;
    onLoadError?: () => void;
  }
>(function TattleHeatMap({ blocks, unit, onViewChange, onLoadError }, ref) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  // Built once: data goes in via injectJavaScript so the map keeps its viewport.
  const html = useMemo(() => buildHtml(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, DEFAULT_ZOOM), []);

  const pushData = useCallback(() => {
    if (!readyRef.current || !webRef.current) return;
    const payload = JSON.stringify({ blocks, unit });
    webRef.current.injectJavaScript(`window.__tattle && window.__tattle.setData(${payload}); true;`);
  }, [blocks, unit]);

  useEffect(() => {
    pushData();
  }, [pushData]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (lat, lng, zoom) => {
        if (!readyRef.current || !webRef.current) return;
        const args = [lat, lng, zoom ?? 17].map((n) => Number(n)).join(",");
        webRef.current.injectJavaScript(`window.__tattle && window.__tattle.flyTo(${args}); true;`);
      },
    }),
    []
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg?.type === "ready") {
      readyRef.current = true;
      pushData();
    } else if (msg?.type === "view" && msg.center && msg.bounds) {
      onViewChange?.({ center: msg.center, bounds: msg.bounds, zoom: msg.zoom });
    } else if (msg?.type === "error") {
      onLoadError?.();
    }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: "#e8e4dc" }}
        onMessage={handleMessage}
        originWhitelist={["*"]}
        onLoadStart={() => {
          // A reload (e.g. after the OS kills the WebView process) starts over.
          readyRef.current = false;
        }}
        onError={() => onLoadError?.()}
        setSupportMultipleWindows={false}
      />
    </View>
  );
});
