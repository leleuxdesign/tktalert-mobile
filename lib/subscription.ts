/**
 * One source of truth for how a subscription state is described.
 *
 * Before this existed, a single account could be shown three different ways at
 * once: Settings rendered the raw enum in a badge ("trial") beside a label
 * reading "Lapsed", while the Dashboard called the same state "Inactive". Two
 * of those were wrong and one leaked a database value into the UI.
 *
 * The other half of the problem was that "lapsed" was used for two genuinely
 * different situations — someone whose subscription ended, and someone who
 * never had one. Telling a brand-new user "your subscription ended" is simply
 * false, and it is the first thing they see. `subscribedAt` distinguishes them:
 * it stays null until the server records a first paid subscription.
 *
 * `storePro` (D-13) is the store's own view via RevenueCat. The server is the
 * source of truth, but its webhook can lag a purchase by seconds; when the store
 * already reports the "pro" entitlement the account reads as active meanwhile.
 */
export type SubscriptionView = {
  /** Short word for a badge or status tile. */
  badge: string;
  /** Human plan name for a settings row. */
  planLabel: string;
  /** True when alerts are actually being delivered. */
  entitled: boolean;
  /** True when alerts are off and the user can do something about it. */
  paused: boolean;
  /** True when this account has never had a paid subscription. */
  neverSubscribed: boolean;
};

export function describeSubscription(
  user: {
    subscriptionStatus?: string | null;
    subscribedAt?: string | Date | null;
  },
  storePro = false
): SubscriptionView {
  const status = (user.subscriptionStatus ?? "").toLowerCase();
  const neverSubscribed = !user.subscribedAt;

  if (status === "comped") {
    return {
      badge: "Active",
      planLabel: "Comped (Free)",
      entitled: true,
      paused: false,
      neverSubscribed,
    };
  }

  if (status === "active" || storePro) {
    return {
      badge: "Active",
      planLabel: "Active Subscription",
      entitled: true,
      paused: false,
      neverSubscribed: false,
    };
  }

  // Everything else — lapsed, cancelled, and the legacy "trial" rows that no
  // longer entitle anyone — means alerts are off. The wording is what differs,
  // and it turns on whether this person ever actually subscribed.
  return {
    badge: neverSubscribed ? "Inactive" : "Paused",
    planLabel: neverSubscribed ? "No subscription" : "Lapsed",
    entitled: false,
    paused: true,
    neverSubscribed,
  };
}
