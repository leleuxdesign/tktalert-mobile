import { useEffect, useRef } from "react";
import { AppState, Linking } from "react-native";
import { trpc } from "@/lib/trpc";
import { logAction } from "@/lib/analytics";

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
  // Analytics only: true between opening Stripe and the next foreground, so the
  // instance whose checkout was started (and only that one) logs the return.
  const awaitingReturnRef = useRef(false);

  const checkoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: async (data: any) => {
      logAction("checkout_opened");
      awaitingReturnRef.current = true;
      await Linking.openURL(data?.url || RENEW_URL);
    },
    // Fall back to web checkout rather than leaving the button dead.
    onError: () => {
      logAction("checkout_opened");
      awaitingReturnRef.current = true;
      Linking.openURL(RENEW_URL);
    },
  });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && awaitingReturnRef.current) {
        awaitingReturnRef.current = false;
        logAction("checkout_returned");
      }
    });
    return () => sub.remove();
  }, []);

  const startCheckout = () => {
    logAction("subscribe_tapped");
    checkoutMutation.mutate({
      successUrl: `${APP_WEB_URL}/subscribed?source=app`,
      cancelUrl: `${APP_WEB_URL}/subscribed?source=app&cancelled=1`,
    });
  };

  return { startCheckout, isPending: checkoutMutation.isPending };
}
