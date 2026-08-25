// Service areas TattleTow currently covers. Extend this list as new
// cities/states are added — the combo picker and the map's out-of-area
// check both read directly from here.
export const SERVICE_AREAS = [{ city: "Milwaukee", state: "WI", label: "Milwaukee, WI" }] as const;

export type ServiceArea = (typeof SERVICE_AREAS)[number];

export const DEFAULT_CITY = SERVICE_AREAS[0].city;
export const DEFAULT_STATE = SERVICE_AREAS[0].state;

// Milwaukee, WI — default map center when we don't have the user's location.
export const DEFAULT_MAP_CENTER = { lat: 43.0389, lng: -87.9065 };

export function findServiceArea(city: string, state: string): ServiceArea | undefined {
  const c = city.trim().toLowerCase();
  const s = state.trim().toLowerCase();
  return SERVICE_AREAS.find((a) => a.city.toLowerCase() === c && a.state.toLowerCase() === s);
}
