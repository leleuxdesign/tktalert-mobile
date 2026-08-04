import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppRouter } from "./router-types";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = "https://api.tktalert.net";

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await AsyncStorage.getItem("auth_token");
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
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
