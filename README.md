# TKTAlert Mobile — Expo App

React Native / Expo app for TKTAlert — Parking Ticket Alerts.
Connects to the EC2 backend at `https://api.tktalert.net`.

---

## Project Structure

```
app/
  _layout.tsx          — Root layout: tRPC provider, auth guard, push setup
  index.tsx            — Root redirect
  auth/
    _layout.tsx        — Auth stack layout
    login.tsx          — Sign in screen
    signup.tsx         — Create account screen
    forgot-password.tsx — Password reset screen
  tabs/
    _layout.tsx        — Bottom tab navigator
    dashboard.tsx      — Home: zones + recent alerts
    alerts.tsx         — Full alert history
    settings.tsx       — Zones management + account
hooks/
  useAuth.ts           — Auth state from AsyncStorage
  usePushNotifications.ts — Expo push token registration
lib/
  trpc.ts              — tRPC client → api.tktalert.net
  router-types.ts      — AppRouter type stub
assets/                — App icon, splash, adaptive icon
```

---

## Local Development

```bash
# Install dependencies
pnpm install

# Start Expo dev server
pnpm start

# Then press:
#   i — open iOS Simulator
#   a — open Android Emulator
#   s — scan QR with Expo Go app on your phone
```

---

## Building for Stores (EAS Build)

### Prerequisites

1. **Expo Account** — create one at https://expo.dev
2. **Apple Developer Account** ($99/year) — https://developer.apple.com
3. **Google Play Developer Account** ($25 one-time) — https://play.google.com/console

### Step 1 — Log in to EAS

```bash
pnpm exec eas login
```

### Step 2 — Initialize the EAS project

```bash
pnpm exec eas init
```

This creates a project on expo.dev and adds `extra.eas.projectId` to `app.json`.
Copy the project ID — you'll need it for push notifications.

### Step 3 — Configure `eas.json`

Edit `eas.json` and fill in your Apple credentials:
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your@apple.com",
      "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
      "appleTeamId": "YOUR_TEAM_ID"
    }
  }
}
```

### Step 4 — Build

```bash
# iOS production build (requires Apple Developer account)
pnpm run build:ios

# Android production build
pnpm run build:android

# Both platforms (internal preview APK — no store accounts needed)
pnpm run build:preview
```

EAS Build runs in the cloud — you don't need Xcode or Android Studio locally.

### Step 5 — Submit to stores

```bash
# Submit to App Store (requires Apple Developer account)
pnpm run submit:ios

# Submit to Google Play
pnpm run submit:android
```

---

## Push Notifications Setup

### Apple (APNs)

1. In your Apple Developer account, go to **Certificates, Identifiers & Profiles**
2. Create an **APNs Key** (not a certificate — keys are simpler)
3. Download the `.p8` file and note the Key ID and Team ID
4. In your Expo project dashboard (expo.dev), go to **Credentials → iOS → Push Notifications**
5. Upload the `.p8` file with the Key ID and Team ID

### Google (FCM)

1. Go to **Firebase Console** → https://console.firebase.google.com
2. Create a new project (or use existing) named `tktalert`
3. Add an Android app with package name `net.tktalert.app`
4. Download `google-services.json` and place it in the project root
5. In Firebase Console → Project Settings → Cloud Messaging → copy the **Server Key**
6. In your Expo project dashboard → Credentials → Android → FCM → paste the server key

### Backend — Register Push Token

After setup, the `usePushNotifications` hook registers the device token.
You need to add a backend procedure to save it:

```ts
// In server/routers.ts — add to the auth/user router
savePushToken: protectedProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await db.updateUserPushToken(ctx.user.id, input.token);
    return { ok: true };
  }),
```

Then in `app/_layout.tsx`, call this mutation when `expoPushToken` is available.

---

## App Store Metadata

### iOS App Store

- **App Name:** TKTAlert — Parking Ticket Alerts
- **Bundle ID:** `net.tktalert.app`
- **Category:** Utilities
- **Age Rating:** 4+
- **Privacy Policy URL:** https://tktalert.net/privacy
- **Support URL:** https://tktalert.net/support

### Google Play Store

- **Package Name:** `net.tktalert.app`
- **Category:** Tools
- **Content Rating:** Everyone

---

## Environment

The API base URL is hardcoded in `lib/trpc.ts`:
```ts
const API_URL = "https://api.tktalert.net";
```

To change it for development, update this value directly.

---

## Disclaimer

TKTAlert monitors publicly available city data. Alerts are informational only
and do not guarantee ticket prevention. Not affiliated with the City of Milwaukee.
