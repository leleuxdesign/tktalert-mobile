import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * App Store storefront gate for Apple Guideline 3.1.1(a) compliance.
 *
 * The US-storefront external-link allowance (Guideline 3.1.1(a), updated
 * 2025-05-01) only applies on the United States storefront. So the app-started
 * Stripe checkout CTA — a link out to our own web checkout — must be shown ONLY
 * when the device's App Store *storefront* is the United States (country
 * "USA"). On any other storefront the anti-steering prohibition still applies
 * and the CTA (and any web-subscribe reference) must be hidden.
 *
 * This is the STOREFRONT, not the device locale/region. Locale is user-settable
 * and is NOT what Apple checks; only StoreKit's `Storefront.current.countryCode`
 * (ISO-3166-1 alpha-3, e.g. "USA") is authoritative. Reading it requires no
 * entitlement, no IAP capability, and no In-App Purchase.
 *
 * The read is backed by an OPTIONAL native module named `AppStorefront`
 * (a thin StoreKit-2 `Storefront.current` reader). When that native module is
 * not present in the binary, `requireOptionalNativeModule` returns `null` and
 * the storefront is reported as unknown. Because TattleTow ships to the US
 * storefront ONLY, an unknown storefront is treated as US (CTA visible) so that
 * real US users are never stranded without a way to subscribe/renew. The gate
 * flips to actively HIDING the CTA the moment a *confirmed non-US* storefront is
 * reported — so a future non-US expansion (or a non-US reviewer) cannot regress
 * the 3.1.1(a) posture.
 */

type AppStorefrontModule = {
  /** StoreKit `Storefront.current?.countryCode`, or null if unavailable. */
  getCountryCode(): Promise<string | null>;
};

// Storefront only exists on the Apple App Store; other platforms report null.
const nativeStorefront =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<AppStorefrontModule>("AppStorefront")
    : null;

/** True when the native storefront read is wired into this binary. */
export const STOREFRONT_READ_AVAILABLE = nativeStorefront != null;

/**
 * ISO alpha-3 country code of the App Store storefront, or `null` when it
 * cannot be determined (native module absent, read failed, or non-iOS).
 */
export async function getStorefrontCountryCode(): Promise<string | null> {
  if (!nativeStorefront) return null;
  try {
    return await nativeStorefront.getCountryCode();
  } catch {
    return null;
  }
}

/**
 * True only when the device is CONFIRMED to be on a non-US App Store
 * storefront. Unknown (`null`) is deliberately NOT treated as non-US.
 */
export function isConfirmedNonUSStorefront(code: string | null): boolean {
  return code != null && code !== "USA";
}

/**
 * Whether to render the Stripe checkout CTA (Subscribe / Renew link-out).
 * Returns `true` unless the storefront is confirmed non-US. Starts `true` so the
 * CTA is present on first paint for US users, then hides if a non-US storefront
 * is confirmed.
 */
export function useShowSubscribeCTA(): boolean {
  const [countryCode, setCountryCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getStorefrontCountryCode().then((code) => {
      if (active) setCountryCode(code);
    });
    return () => {
      active = false;
    };
  }, []);

  return !isConfirmedNonUSStorefront(countryCode);
}
