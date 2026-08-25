import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "./router-types";

export const trpc = createTRPCReact<AppRouter>();

// Whatever host ships in a store build is what every installed copy calls until
// the user updates — so this must be the canonical domain, not a redirect source.
const API_URL = "https://app.tattletow.com";

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        transformer: superjson,
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
