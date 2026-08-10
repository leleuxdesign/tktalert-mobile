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
    register: t.procedure.input(passthrough).mutation((): any => ({})),
    login: t.procedure.input(passthrough).mutation((): any => ({})),
    logout: t.procedure.mutation((): any => ({})),
    forgotPassword: t.procedure.input(passthrough).mutation((): any => ({})),
    updateProfile: t.procedure.input(passthrough).mutation((): any => ({})),
    changePassword: t.procedure.input(passthrough).mutation((): any => ({})),
    recordConsent: t.procedure.mutation((): any => ({})),
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
  stripe: t.router({
    createCheckoutSession: t.procedure.input(passthrough).mutation((): any => ({})),
  }),
});

export type AppRouter = typeof appRouter;
