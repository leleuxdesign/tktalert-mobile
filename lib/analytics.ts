/**
 * Lean, in-house per-user product analytics (feature D-12, spec
 * FEATURE-SPEC-2026-09-23-user-analytics.md). Journey + stuck points only —
 * NOT session replay, NOT an every-tap clickstream.
 *
 * Hard rules this module enforces:
 *  - Fire-and-forget. Analytics must NEVER block the UI or throw into the app.
 *    Every public entry point swallows its own errors; a failed flush drops the
 *    buffer quietly (the spec's instruction) rather than retrying forever.
 *  - No PII / no content. Only screen names, allow-listed action names, and a
 *    small enum/numeric `value`. Never message text, addresses, field contents,
 *    tokens, phone numbers, or emails.
 *  - The server stamps `userId` from the session cookie; the client never sends
 *    a user id. `sessionId` is generated once per app launch.
 *  - Respects the server kill-switch (`analytics.config`): when capture is off,
 *    nothing is buffered. (The server also no-ops `analytics.track` when off, so
 *    this is a courtesy/bandwidth optimization, not the only line of defense.)
 */
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { useSegments } from "expo-router";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "./router-types";

// Same canonical host as lib/trpc.ts — whatever ships in a store build is what
// every installed copy calls until the user updates, so it must be the
// canonical domain, never a redirect source. Kept as a literal (not imported)
// so this fire-and-forget client stands alone from the React query client.
const API_URL = "https://app.tattletow.com";

/** The bounded allow-list of meaningful actions (spec §Depth). Nothing else is sent. */
export type AnalyticsAction =
  | "subscribe_tapped"
  | "checkout_opened"
  | "checkout_returned"
  | "add_zone_opened"
  | "zone_created"
  | "zone_delete"
  | "alert_opened"
  | "map_opened"
  | "map_range_changed"
  | "support_opened"
  | "message_sent"
  | "signup_started"
  | "signup_completed"
  | "login"
  | "logout"
  | "notif_permission_prompt"
  | "notif_permission_result";

const ALLOWED_ACTIONS: ReadonlySet<string> = new Set<AnalyticsAction>([
  "subscribe_tapped",
  "checkout_opened",
  "checkout_returned",
  "add_zone_opened",
  "zone_created",
  "zone_delete",
  "alert_opened",
  "map_opened",
  "map_range_changed",
  "support_opened",
  "message_sent",
  "signup_started",
  "signup_completed",
  "login",
  "logout",
  "notif_permission_prompt",
  "notif_permission_result",
]);

type BufferedEvent =
  | { eventType: "screen_view"; name: string; enteredAt: string; durationMs: number }
  | { eventType: "action"; name: AnalyticsAction; occurredAt: string; value?: string | number | null };

const PLATFORM: "ios" | "android" | "web" =
  Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
const APP_VERSION = String(Constants.expoConfig?.version ?? "unknown");

/** One id per launch. Not crypto-strong on purpose — it only groups a session. */
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const FLUSH_INTERVAL_MS = 15_000;
// A hard ceiling so a long offline stretch can't grow the buffer without bound;
// oldest events fall off first (they're the least useful for a live journey).
const MAX_BUFFER = 200;

let buffer: BufferedEvent[] = [];
// Optimistic default: capture until the server says otherwise. The server also
// no-ops track() when the kill-switch is on, so a stale `true` here still can't
// write data the server has switched off.
let captureEnabled = true;
let initialized = false;
let flushInFlight = false;

// Standalone (non-React) tRPC client so flushing works from timers and AppState
// listeners, outside any render. Uses the same session cookie via credentials:
// include, which is how the server stamps userId.
const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      transformer: superjson,
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

/** Truncate a value so an enum/number stays small and can never smuggle content. */
function clampValue(value: string | number | null | undefined): string | number | null | undefined {
  if (value == null) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return String(value).slice(0, 32);
}

/**
 * Screen name from expo-router segments. Segments are the in-source route names
 * ("tabs", "dashboard", "[id]"), not resolved URLs — but as a belt-and-braces
 * guard against any dynamic value leaking in, any all-numeric segment is masked.
 */
function screenNameFromSegments(segments: string[]): string {
  const parts = segments.filter(Boolean).map((s) => (/^\d+$/.test(s) ? ":id" : s));
  return parts.length ? parts.join("/") : "root";
}

function push(event: BufferedEvent) {
  if (!captureEnabled) return;
  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(buffer.length - MAX_BUFFER);
}

/** Record a screen view with its dwell (ms). Called centrally on leave/background. */
export function logScreenView(name: string, enteredAtMs: number, durationMs: number) {
  try {
    push({
      eventType: "screen_view",
      name: String(name).slice(0, 64),
      enteredAt: new Date(enteredAtMs).toISOString(),
      durationMs: Math.max(0, Math.round(durationMs)),
    });
  } catch {
    // Analytics never throws into the app.
  }
}

/** Record an allow-listed action. Unknown names are dropped, not sent. */
export function logAction(name: AnalyticsAction, value?: string | number | null) {
  try {
    if (!ALLOWED_ACTIONS.has(name)) return;
    push({
      eventType: "action",
      name,
      occurredAt: new Date().toISOString(),
      value: clampValue(value),
    });
  } catch {
    // Analytics never throws into the app.
  }
}

/** Send the buffer. On any failure the batch is dropped quietly (per spec). */
export async function flushAnalytics(): Promise<void> {
  if (flushInFlight || buffer.length === 0 || !captureEnabled) return;
  const batch = buffer;
  buffer = [];
  flushInFlight = true;
  try {
    await client.analytics.track.mutate({
      sessionId: SESSION_ID,
      platform: PLATFORM,
      appVersion: APP_VERSION,
      events: batch,
    });
  } catch {
    // Drop the buffer quietly — analytics correctness is never worth a retry
    // storm or a surfaced error. The events are gone; that's acceptable.
  } finally {
    flushInFlight = false;
  }
}

/** Ask the server whether capture is on. Failure leaves the current setting. */
async function refreshConfig(): Promise<void> {
  try {
    const config = await client.analytics.config.query();
    captureEnabled = config?.enabled !== false;
    if (!captureEnabled) buffer = [];
  } catch {
    // Keep whatever we had; the server-side kill-switch still protects data.
  }
}

/**
 * Start the timer + lifecycle flushes and read the kill-switch. Idempotent —
 * safe to call from the root layout on every mount.
 */
export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  try {
    refreshConfig();
    setInterval(() => {
      void flushAnalytics();
    }, FLUSH_INTERVAL_MS);
    AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        void flushAnalytics();
      } else if (state === "active") {
        void refreshConfig();
      }
    });
  } catch {
    // Never let analytics setup break app startup.
  }
}

/**
 * Central screen_view tracking. One listener in the root layout instead of
 * per-screen boilerplate: logs a screen_view (with dwell) when the route
 * changes, and finalizes the current screen's dwell on backgrounding so the
 * last screen before a drop-off is still captured.
 */
export function useScreenTracking() {
  const segments = useSegments();
  const currentScreenRef = useRef<string | null>(null);
  const enteredAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const name = screenNameFromSegments(segments as string[]);
    const now = Date.now();
    const prev = currentScreenRef.current;
    if (prev !== null && prev !== name) {
      logScreenView(prev, enteredAtRef.current, now - enteredAtRef.current);
    }
    if (prev !== name) {
      currentScreenRef.current = name;
      enteredAtRef.current = now;
    }
  }, [segments]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const now = Date.now();
      if (state === "background" || state === "inactive") {
        // Finalize the current screen so drop-off has a last event, then flush
        // it out while it's fresh (the app may not come back).
        if (currentScreenRef.current) {
          logScreenView(currentScreenRef.current, enteredAtRef.current, now - enteredAtRef.current);
          enteredAtRef.current = now;
          void flushAnalytics();
        }
      } else if (state === "active") {
        // Returning counts as a fresh dwell on the same screen.
        enteredAtRef.current = now;
      }
    });
    return () => sub.remove();
  }, []);
}
