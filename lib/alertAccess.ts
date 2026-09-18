// MIRROR of tktalert-app/shared/alertAccess.ts (abe4596). Kept byte-identical
// below the header so the app and the web app render the same rule; update
// both together, like lib/router-types.ts.
// What the alert UI may offer, from map.access()'s { tier, alertChannels }.
// server/entitlement.ts owns the rule (Owner ruling 2026-09-18: free = push
// only, on one zone; paid = push + email + SMS on every zone). This file only
// renders it, so web and app cannot drift apart or re-derive it locally.

export type AlertAccess =
  | {
      tier?: "free" | "paid";
      alertChannels?: {
        push: boolean;
        email: boolean;
        sms: boolean;
        /** paid: null = all zones. free: the one alerting zone, or null. */
        zoneId: number | null;
      };
    }
  | null
  | undefined;

export type AlertAvailability = {
  push: boolean;
  /** False = the "Email me alerts" switch must read unavailable, not off. */
  email: boolean;
  /** False = the "Text me alerts" switch must read unavailable, not off. */
  sms: boolean;
  /** True when only one zone alerts (free). */
  singleZone: boolean;
  /** The zone that alerts on a single-zone plan; null otherwise. */
  alertingZoneId: number | null;
  /** Why email/SMS are unavailable; null when they are available. */
  unavailableReason: string | null;
  /**
   * Does this zone alert? null while access is still loading, so a zone list
   * can hold off rather than flash a "not alerting" badge on a paid account.
   */
  zoneAlerts: (zoneId: number) => boolean | null;
};

export const ALERTS_UPGRADE_REASON = "Text and email alerts are part of a subscription.";

export const SINGLE_ZONE_ALERT_NOTE = "Free accounts get push alerts on 1 watch zone.";

/** Badge copy for a zone that exists but does not alert on this plan. */
export const ZONE_NOT_ALERTING_LABEL = "Not alerting";

export function alertAvailability(access: AlertAccess): AlertAvailability {
  const ch = access?.alertChannels;
  // Still loading: assume nothing. Showing a paid user's switches as
  // "unavailable" for a frame is worse than a beat of normal-looking UI.
  if (!ch) {
    return {
      push: true,
      email: true,
      sms: true,
      singleZone: false,
      alertingZoneId: null,
      unavailableReason: null,
      zoneAlerts: () => null,
    };
  }
  // zoneId is null both for "all zones" (paid) and "no zones yet" (free), so
  // the tier is what separates them — never the null alone.
  const singleZone = access?.tier !== "paid";
  return {
    push: ch.push,
    email: ch.email,
    sms: ch.sms,
    singleZone,
    alertingZoneId: singleZone ? ch.zoneId : null,
    unavailableReason: ch.email && ch.sms ? null : ALERTS_UPGRADE_REASON,
    zoneAlerts: (zoneId: number) => (singleZone ? ch.zoneId === zoneId : true),
  };
}
