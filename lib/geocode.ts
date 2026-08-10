// Reverse geocoding via OpenStreetMap's Nominatim (free, no API key).
// Usage policy requires a descriptive User-Agent and at most ~1 req/sec,
// which is fine for a user tapping a map once.
export interface ReverseGeocodeResult {
  houseNumber: string;
  street: string;
  city: string;
  state: string;
  displayName: string;
  lat: number;
  lng: number;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "TKTAlert/1.0 (parking complaint alerts)" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const addr = data?.address;
  if (!addr) return null;

  const stateAbbrevs: Record<string, string> = { wisconsin: "WI" };
  const stateName = String(addr.state ?? "").toLowerCase();

  return {
    houseNumber: addr.house_number ?? "",
    street: addr.road ?? "",
    city: addr.city ?? addr.town ?? addr.village ?? "",
    state: stateAbbrevs[stateName] ?? "",
    displayName: data.display_name ?? "",
    lat,
    lng,
  };
}
