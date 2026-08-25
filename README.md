# TattleTow Mobile — Expo App

React Native / Expo app for TattleTow — Parking Ticket Alerts.
Connects to the EC2 backend at `https://app.tattletow.com`.

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
  trpc.ts              — tRPC client → app.tattletow.com
  router-types.ts      — AppRouter type stub
assets/                — App icon, splash, adaptive icon
```

---

## Local Development

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

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
npx eas login
```

### Step 2 — Initialize the EAS project

```bash
npx eas init
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
npm run build:ios

# Android production build
npm run build:android

# Both platforms (internal preview APK — no store accounts needed)
npm run build:preview
```

EAS Build runs in the cloud — you don't need Xcode or Android Studio locally.

### Step 5 — Submit to stores

```bash
# Submit to App Store (requires Apple Developer account)
npm run submit:ios

# Submit to Google Play
npm run submit:android
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
2. Create a new project (or use existing) named `tattletow`
3. Add an Android app with package name `net.tattletow.app`
4. Download `google-services.json` and place it in the project root
5. In Firebase Console → Project Settings → Cloud Messaging → copy the **Server Key**
6. In your Expo project dashboard → Credentials → Android → FCM → paste the server key

### Backend — Register Push Token

Already wired. `usePushNotifications` obtains the Expo token and `app/_layout.tsx`
saves it via `auth.savePushToken` once the user is authenticated.

Note the input field is **`expoPushToken`**, not `token`:

```ts
// server/routers.ts
savePushToken: protectedProcedure
  .input(z.object({ expoPushToken: z.string().min(1) }))
```

`server/scanner.ts` then sends push as a third alert channel alongside SMS and
email, recorded in `alerts_sent` with the same success/failure tracking.

---

## App Store Metadata

### iOS App Store

- **App Name:** TattleTow — Parking Ticket Alerts
- **Bundle ID:** `net.tattletow.app`
- **Category:** Utilities
- **Age Rating:** 4+
- **Privacy Policy URL:** https://tattletow.com/privacy
- **Support URL:** https://tattletow.com/support

### Google Play Store

- **Package Name:** `net.tattletow.app`
- **Category:** Tools
- **Content Rating:** Everyone

---

## Environment

The API base URL is hardcoded in `lib/trpc.ts`:
```ts
const API_URL = "https://app.tattletow.com";
```

To change it for development, update this value directly.

---

## Disclaimer

TattleTow monitors publicly available city data. Alerts are informational only
and do not guarantee ticket prevention. Not affiliated with the City of Milwaukee.
