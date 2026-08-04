import { Redirect } from "expo-router";

// Root redirect — AuthGuard in _layout.tsx handles the actual routing
export default function Index() {
  return <Redirect href="/tabs/dashboard" />;
}
