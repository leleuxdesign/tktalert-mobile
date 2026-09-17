// This file re-exports the AppRouter type from the backend.
// When the backend is available locally, replace this with:
//   export type { AppRouter } from "../../tktalert-app/server/routers";
// For now we use a minimal type that covers the procedures we call.
//
// This has to be a structurally real (finite) router built with initTRPC,
// not `any` or `AnyRouter` — @trpc/react-query's hook-name collision check
// is a mapped type over `keyof TRouter['_def']['record']`, and both `any`
// and the unconstrained `AnyRouter` bound make that key set infinite
// (`string | number | symbol`), which collapses every hook's type into the
// collision-check's error-message union instead of per-procedure types.
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

const t = initTRPC.create({ transformer: superjson });
const passthrough = (input: unknown) => input as any;

export type HeatBlock = { blockKey: string; label: string; lat: number; lng: number; count: number };
export type MapAccess = {
  tier: "free" | "paid";
  complaintMap: true;
  ticketMap: boolean;
  alerts: boolean;
  /**
   * Whether ticket data exists for this account's city; same value for every
   * tier (false for Milwaukee). The Tickets segment shows only when true:
   * locked for free accounts, open for paid ones.
   */
  ticketDataAvailable: boolean;
  /** Max active watch zones: 1 for free, null for unlimited (paid). */
  zoneLimit: number | null;
  /** Active zones. May exceed zoneLimit for legacy/lapsed accounts, who keep them all. */
  zoneCount: number;
};
/** Zone color keys (tktalert-app shared/zoneColors.ts). Unknown keys render blue. */
export type ZoneColorKey = "blue" | "green" | "orange" | "purple" | "red" | "teal" | "pink" | "yellow";
/** map.myZones item: the caller's active zones; lat/lng null when unplaceable. */
export type ZonePin = {
  id: number;
  label: string | null;
  street: string;
  blockStart: number;
  blockEnd: number;
  color: ZoneColorKey;
  lat: number | null;
  lng: number | null;
};
export type ComplaintHeat = {
  days: 30 | 90 | 365;
  from: string;
  to: string;
  generatedAt: string;
  totalBlocks: number;
  truncated: boolean;
  blocks: HeatBlock[];
};
export type TicketHeat = {
  days: 30 | 90 | 365;
  from: string;
  to: string;
  available: boolean;
  reason?: string;
  blocks: HeatBlock[];
};

const appRouter = t.router({
  auth: t.router({
    me: t.procedure.query((): any => ({})),
    // { email, password, name?, phone?, city?, smsConsent? } — `smsConsent`
    // is refused server-side unless `phone` comes with it.
    register: t.procedure.input(passthrough).mutation((): any => ({})),
    login: t.procedure.input(passthrough).mutation((): any => ({})),
    logout: t.procedure.mutation((): any => ({})),
    forgotPassword: t.procedure.input(passthrough).mutation((): any => ({})),
    resetPassword: t.procedure.input(passthrough).mutation((): any => ({})),
    updateProfile: t.procedure.input(passthrough).mutation((): any => ({})),
    changePassword: t.procedure.input(passthrough).mutation((): any => ({})),
    savePushToken: t.procedure.input(passthrough).mutation((): any => ({})),
    // Input shape (tktalert-app/server/routers.ts, auth.recordConsent):
    //   { smsConsent?: boolean; scope?: "signup" | "sms" } | undefined
    // `scope: "sms"` updates only `smsConsentAt`; the default also stamps
    // `consentGivenAt`, which must not be re-stamped by a Settings toggle.
    recordConsent: t.procedure.input(passthrough).mutation((): any => ({})),
    // ALERT email only. Account mail - password reset, receipts, dunning - and
    // the future marketing drip are separate server paths and never read this.
    setEmailAlerts: t.procedure.input(passthrough).mutation((): any => ({})),
    deleteAccount: t.procedure.input(passthrough).mutation((): any => ({})),
  }),
  adminSupport: t.router({
    // Admin side of the two-way chat, so the Owner can answer from the phone
    // instead of signing into a web console.
    inbox: t.procedure.query((): any[] => []),
    thread: t.procedure.input(passthrough).query((): any => ({ messages: [] })),
    reply: t.procedure.input(passthrough).mutation((): any => ({})),
    markRead: t.procedure.input(passthrough).mutation((): any => ({})),
  }),
  support: t.router({
    // One-to-one conversation with the Owner.
    myThread: t.procedure.query((): any => ({ messages: [], unread: 0 })),
    send: t.procedure.input(passthrough).mutation((): any => ({})),
    markRead: t.procedure.mutation((): any => ({})),
    // Diagnostic snapshot only - no location, contacts or ad identifiers.
    reportDevice: t.procedure.input(passthrough).mutation((): any => ({})),
  }),
  feedback: t.router({
    // The medium that makes a comped tester's access conditional. One-way for
    // now; the v1.5 support chat supersedes it.
    submit: t.procedure.input(passthrough).mutation((): any => ({})),
    mine: t.procedure.query((): any => ({ count: 0 })),
  }),
  map: t.router({
    // Tattle Map (tktalert-app server/tattleMap.ts + server/entitlement.ts).
    // Every procedure needs a signed-in account.
    //
    // What this account can use; clients render locks/upsells from it:
    //   { tier: "free" | "paid"; complaintMap: true; ticketMap: boolean;
    //     ticketDataAvailable: boolean; alerts: boolean;
    //     zoneLimit: number | null; zoneCount: number }
    access: t.procedure.query((): MapAccess => ({
      tier: "free", complaintMap: true, ticketMap: false, ticketDataAvailable: false, alerts: false, zoneLimit: 1, zoneCount: 0,
    })),
    // The caller's own active zones as map pins (free or paid; no input).
    myZones: t.procedure.query((): ZonePin[] => []),
    // FREE tier. Input: { days?: 30 | 90 | 365 = 30;
    //   bounds?: { north, south, east, west }; limit?: 1..2000 = 500 }
    // Block-level aggregates only; the most recent 72h are excluded server-side.
    complaintHeat: t.procedure.input(passthrough).query((): ComplaintHeat => ({
      days: 30, from: "", to: "", generatedAt: "", totalBlocks: 0, truncated: false, blocks: [],
    })),
    // PAID tier. Input: { days?: 30 | 90 | 365 } | undefined. Free accounts get
    // FORBIDDEN "This feature requires a TattleTow subscription.". Until a city
    // has ticket data this returns { available: false, blocks: [] }.
    ticketHeat: t.procedure.input(passthrough).query((): TicketHeat => ({
      days: 30, from: "", to: "", available: false, blocks: [],
    })),
  }),
  streets: t.router({
    // Typeahead over the City of Milwaukee's official street list, so a watch
    // zone can be chosen rather than typed. Exact-match zone matching means a
    // typo produces a zone that silently never fires.
    search: t.procedure.input(passthrough).query((): any[] => []),
  }),
  zones: t.router({
    // Items carry `color: ZoneColorKey` (server-assigned, not user-editable).
    list: t.procedure.query((): any[] => []),
    // FORBIDDEN "Free accounts include 1 watch zone. Subscribe to add more."
    // when a free account is already at map.access().zoneLimit.
    create: t.procedure.input(passthrough).mutation((): any => ({})),
    delete: t.procedure.input(passthrough).mutation((): any => ({})),
  }),
  alerts: t.router({
    myAlerts: t.procedure.input(passthrough).query((): any[] => []),
    activitySummary: t.procedure.query((): any => ({ today: 0, thisWeek: 0, thisMonth: 0 })),
    markRead: t.procedure.input(passthrough).mutation((): any => ({})),
  }),
  serviceArea: t.router({
    logInterest: t.procedure.input(passthrough).mutation((): any => ({})),
  }),
  adminUsers: t.router({
    list: t.procedure.input(passthrough).query((): any[] => []),
    get: t.procedure.input(passthrough).query((): any => ({})),
    update: t.procedure.input(passthrough).mutation((): any => ({})),
    getZones: t.procedure.input(passthrough).query((): any[] => []),
    getAlerts: t.procedure.input(passthrough).query((): any[] => []),
    create: t.procedure.input(passthrough).mutation((): any => ({})),
    createZone: t.procedure.input(passthrough).mutation((): any => ({})),
  }),
  complaints: t.router({
    adminList: t.procedure.input(passthrough).query((): any => ({ items: [], total: 0 })),
  }),
  adminStats: t.router({
    overview: t.procedure.query((): any => ({})),
  }),
  adminAlerts: t.router({
    list: t.procedure.input(passthrough).query((): any => ({ items: [], total: 0 })),
  }),
  adminScanLog: t.router({
    list: t.procedure.input(passthrough).query((): any[] => []),
  }),
  scanner: t.router({
    trigger: t.procedure.mutation((): any => ({})),
    state: t.procedure.query((): any => ({})),
  }),
  stripe: t.router({
    createCheckoutSession: t.procedure.input(passthrough).mutation((): any => ({})),
    createBillingPortalSession: t.procedure.input(passthrough).mutation((): { url: string } => ({ url: "" })),
  }),
});

export type AppRouter = typeof appRouter;
