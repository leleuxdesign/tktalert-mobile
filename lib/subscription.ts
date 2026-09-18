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
 * it stays null until Stripe reports a completed checkout.
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
  /** True when this account has never completed a checkout. */
  neverSubscribed: boolean;
};

export function describeSubscription(user: {
  subscriptionStatus?: string | null;
  subscribedAt?: string | Date | null;
}): SubscriptionView {
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

  if (status === "active") {
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
    // Owner ruling 2026-09-18: an account without a subscription is a working
    // free plan (push alerts on one zone), not an inactive one.
    badge: neverSubscribed ? "Free" : "Paused",
    planLabel: neverSubscribed ? "Free plan" : "Lapsed",
    entitled: false,
    paused: true,
    neverSubscribed,
  };
}
