import { useRef, useState, useCallback, useEffect } from "react";
import { View, Text, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { colors, fontFamily } from "@/lib/ios6-theme";
import { reverseGeocode, ReverseGeocodeResult } from "@/lib/geocode";
import { DEFAULT_MAP_CENTER } from "@/lib/supported-locations";
import { IosNavBar, IosButton, IosPage } from "@/components/ios6";

function buildMapHtml(lat: number, lng: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);

    function send(lat, lng) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat, lng }));
    }

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      send(p.lat, p.lng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      send(e.latlng.lat, e.latlng.lng);
    });

    send(${lat}, ${lng});
  </script>
</body>
</html>`;
}

export function AddressMapPicker({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: ReverseGeocodeResult) => void;
}) {
  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [ready, setReady] = useState(false);
  const [coords, setCoords] = useState(DEFAULT_MAP_CENTER);
  const [resolving, setResolving] = useState(false);
  const html = useRef<string | null>(null);

  const initMap = useCallback(async () => {
    setReady(false);
    let start = DEFAULT_MAP_CENTER;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        start = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      // fall back to default center
    }
    setCenter(start);
    setCoords(start);
    html.current = buildMapHtml(start.lat, start.lng);
    setReady(true);
  }, []);

  // Re-init whenever the modal opens
  useEffect(() => {
    if (visible) {
      initMap();
    } else {
      setReady(false);
      html.current = null;
    }
  }, [visible, initMap]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        setCoords({ lat: data.lat, lng: data.lng });
      }
    } catch {}
  };

  const handleUseLocation = async () => {
    setResolving(true);
    try {
      const result = await reverseGeocode(coords.lat, coords.lng);
      if (!result) {
        setResolving(false);
        return;
      }
      onConfirm(result);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <IosPage>
        <IosNavBar title="Locate Your Address" onBack={onClose} backLabel="Cancel" />
        {ready && html.current ? (
          <>
            <WebView
              source={{ html: html.current }}
              style={{ flex: 1 }}
              onMessage={handleMessage}
              originWhitelist={["*"]}
            />
            <View style={styles.footer}>
              <Text style={styles.hint}>Tap or drag the pin to your exact spot</Text>
              <IosButton variant="blue" onPress={handleUseLocation} loading={resolving}>
                Use This Location →
              </IosButton>
            </View>
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.blue} size="large" />
            <Text style={styles.hint}>Finding your location…</Text>
          </View>
        )}
      </IosPage>
    </Modal>
  );
}

const styles = StyleSheet.create({
  footer: { padding: 16, gap: 10, backgroundColor: colors.background },
  hint: { fontSize: 13, color: colors.textLight, textAlign: "center", fontFamily },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
