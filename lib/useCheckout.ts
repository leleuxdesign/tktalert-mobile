import { Linking } from "react-native";
import { trpc } from "@/lib/trpc";

export const APP_WEB_URL = "https://app.tattletow.com";
/** Web checkout: only a fallback now, if the app cannot start its own. */
export const RENEW_URL = `${APP_WEB_URL}/subscribe`;

/**
 * App-started Stripe checkout, shared by every upgrade entry point (Dashboard,
 * Tattle Map) so there is exactly one checkout path to keep correct.
 *
 * Checkout starts from the app's own session: the server creates the Stripe
 * session for this signed-in account, so the customer is not sent to the web
 * to sign in a second time. Stripe then returns them to /subscribed, which
 * hands them back to the app instead of leaving them in the web dashboard.
 */
export function useCheckout() {
  const checkoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: async (data: any) => {
      await Linking.openURL(data?.url || RENEW_URL);
    },
    // Fall back to web checkout rather than leaving the button dead.
    onError: () => {
      Linking.openURL(RENEW_URL);
    },
  });

  const startCheckout = () =>
    checkoutMutation.mutate({
      successUrl: `${APP_WEB_URL}/subscribed?source=app`,
      cancelUrl: `${APP_WEB_URL}/subscribed?source=app&cancelled=1`,
    });

  return { startCheckout, isPending: checkoutMutation.isPending };
}
