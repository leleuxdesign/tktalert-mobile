import { useSyncExternalStore } from "react";
import { Linking, Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
  PURCHASES_ERROR_CODE,
  INTRO_ELIGIBILITY_STATUS,
} from "react-native-purchases";

/**
 * In-app subscriptions through RevenueCat (Owner ruling D-13, 2026-10-07).
 *
 * Contract with the server (Blade, IAP-CONTRACT.md):
 * - RevenueCat app_user_id = TattleTow user id (`Purchases.logIn(String(id))`).
 * - Entitlement "pro"; offering "default"; monthly package; product
 *   `tattletow_monthly` on both stores.
 * - The SERVER is the source of truth for entitlement (RevenueCat webhook →
 *   server). CustomerInfo is used only to unlock optimistically between a
 *   purchase and the webhook landing.
 *
 * Price and trial terms are NEVER hardcoded: they come from the store via the
 * offering, already localized.
 */

export const ENTITLEMENT_ID = "pro";
export const OFFERING_ID = "default";
export const PRODUCT_ID = "tattletow_monthly";

/** Public SDK keys (not secrets). Inlined at bundle time by Expo. */
const API_KEY =
  Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : Platform.OS === "android"
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
      : undefined;

/** False when this build has no key for this platform: the paywall shows "not available yet". */
export const IAP_AVAILABLE = !!API_KEY && API_KEY.trim().length > 0;

// ─── Tiny store for the optimistic entitlement ───────────────────────────────

type State = {
  loaded: boolean;
  storePro: boolean;
  /** "TRIAL" | "INTRO" | "NORMAL" … from the store, when "pro" is active. */
  periodType: string | null;
  /** ISO date the current period (or trial) ends. */
  expirationDate: string | null;
  willRenew: boolean;
};
const EMPTY: State = { loaded: false, storePro: false, periodType: null, expirationDate: null, willRenew: false };
let state: State = EMPTY;
const listeners = new Set<() => void>();
function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Whether the store (via RevenueCat) currently reports an active "pro" entitlement. */
export function useStoreEntitlement(): State {
  return useSyncExternalStore(subscribe, () => state);
}

export function hasPro(info: CustomerInfo | null | undefined): boolean {
  return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
}

function applyCustomerInfo(info: CustomerInfo) {
  const ent = info?.entitlements?.active?.[ENTITLEMENT_ID];
  setState({
    loaded: true,
    storePro: !!ent,
    periodType: ent?.periodType ?? null,
    expirationDate: ent?.expirationDate ?? null,
    willRenew: !!ent?.willRenew,
  });
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

let configured = false;
let currentUserId: string | null = null;

/** Configure once. Never throws: a missing key or native module leaves IAP off. */
export function configurePurchases(onCustomerInfo?: (info: CustomerInfo) => void): boolean {
  if (configured) return true;
  if (!IAP_AVAILABLE || !API_KEY) return false;
  try {
    Purchases.configure({ apiKey: API_KEY });
    Purchases.addCustomerInfoUpdateListener((info) => {
      applyCustomerInfo(info);
      onCustomerInfo?.(info);
    });
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

/** Identify the signed-in TattleTow user to RevenueCat. Idempotent. */
export async function logInPurchases(userId: number | string): Promise<void> {
  if (!configured) return;
  const id = String(userId);
  if (currentUserId === id) return;
  try {
    const { customerInfo } = await Purchases.logIn(id);
    currentUserId = id;
    applyCustomerInfo(customerInfo);
  } catch {
    // Leave IAP state as-is; the server still decides entitlement.
  }
}

/** Forget the user on sign-out / account deletion. Safe to call repeatedly. */
export async function logOutPurchases(): Promise<void> {
  currentUserId = null;
  setState(EMPTY);
  if (!configured) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch {
    // logOut throws for an anonymous user; nothing to undo.
  }
}

// ─── Offering / display ──────────────────────────────────────────────────────

export type PaywallOffer = {
  pkg: PurchasesPackage;
  /** Store's localized price, e.g. "$3.99". */
  priceString: string;
  /** e.g. "month" — from the product's billing period. */
  periodLabel: string;
  /** e.g. "14-day", or null when there is no trial / the user is not eligible. */
  trialLength: string | null;
};

/** "14-day" / "1-month". Weeks read as days, matching the store copy ("14-day"). */
function lengthLabel(n: number, unit: string): string {
  const u = unit.toUpperCase();
  if (u === "WEEK") return `${n * 7}-day`;
  return `${n}-${u.toLowerCase()}`;
}

/** ISO 8601 "P1M" / "P1Y" / "P1W" → "month" / "year" / "week". */
function periodFromIso(iso: string | null | undefined): string {
  const m = /^P(\d+)([DWMY])$/.exec(iso ?? "");
  if (!m) return "period";
  const n = Number(m[1]);
  const unit = { D: "day", W: "week", M: "month", Y: "year" }[m[2] as "D" | "W" | "M" | "Y"];
  return n === 1 ? unit : `${n} ${unit}s`;
}

function trialFromProduct(pkg: PurchasesPackage): string | null {
  const p = pkg.product;
  // Google Play: the default option carries the free phase only when eligible.
  const free = p.defaultOption?.freePhase;
  if (free) return lengthLabel(free.billingPeriod.value, free.billingPeriod.unit);
  // App Store: introductory offer with a zero price is a free trial.
  const intro = p.introPrice;
  if (intro && intro.price === 0) {
    return lengthLabel(intro.periodNumberOfUnits * Math.max(1, intro.cycles), intro.periodUnit);
  }
  return null;
}

/** Fetch the "default" offering's monthly package. Null when unavailable. */
export async function loadOffer(): Promise<PaywallOffer | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  const offering: PurchasesOffering | undefined =
    offerings.all[OFFERING_ID] ?? offerings.current ?? undefined;
  const pkg = offering?.monthly ?? offering?.availablePackages?.[0];
  if (!pkg) return null;

  let trialLength = trialFromProduct(pkg);
  // Apple shows the intro offer to everyone; only eligible users get it.
  if (trialLength && Platform.OS === "ios") {
    try {
      const elig = await Purchases.checkTrialOrIntroductoryPriceEligibility([pkg.product.identifier]);
      if (elig[pkg.product.identifier]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE) {
        trialLength = null;
      }
    } catch {
      // Unknown eligibility: keep the store's offer text; Apple's sheet is final.
    }
  }

  return {
    pkg,
    priceString: pkg.product.priceString,
    periodLabel: periodFromIso(pkg.product.subscriptionPeriod),
    trialLength,
  };
}

export type PurchaseOutcome = "success" | "cancelled" | "pending" | "not-entitled";

export async function purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return hasPro(customerInfo) ? "success" : "not-entitled";
  } catch (e: any) {
    if (e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return "cancelled";
    if (e?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return "pending";
    throw e;
  }
}

/** Restore store purchases onto the signed-in account. True when "pro" is now active. */
export async function restore(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  applyCustomerInfo(info);
  return hasPro(info);
}

const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : `https://play.google.com/store/account/subscriptions?package=net.tattletow.app&sku=${PRODUCT_ID}`;

/** Open the store's own subscription management (cancel, change payment). */
export async function openManageSubscriptions(): Promise<void> {
  if (configured) {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch {
      // Fall through to the store's subscriptions page.
    }
  }
  await Linking.openURL(STORE_SUBSCRIPTIONS_URL);
}

/** The store's name, for copy that tells people where billing lives. */
export const STORE_NAME = Platform.OS === "ios" ? "App Store" : "Google Play";
