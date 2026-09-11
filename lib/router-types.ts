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
  streets: t.router({
    // Typeahead over the City of Milwaukee's official street list, so a watch
    // zone can be chosen rather than typed. Exact-match zone matching means a
    // typo produces a zone that silently never fires.
    search: t.procedure.input(passthrough).query((): any[] => []),
  }),
  zones: t.router({
    list: t.procedure.query((): any[] => []),
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
    createBillingPortalSession: t.procedure.mutation((): { url: string } => ({ url: "" })),
  }),
});

export type AppRouter = typeof appRouter;
