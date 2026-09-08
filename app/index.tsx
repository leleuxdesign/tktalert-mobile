import { Redirect } from "expo-router";

// Root redirect — AuthGuard in _layout.tsx handles the actual routing.
// Authenticated users are sent on to the dashboard; everyone else is bounced
// to /auth/welcome, which is the first thing a new install should see.
export default function Index() {
  return <Redirect href="/tabs/dashboard" />;
}
