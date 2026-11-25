# NoctOwl Mobile App

Offline-first React Native (Expo) companion app with SQLite queueing, background GPS tracking, MapLibre visualization, and Socket.IO realtime updates.

## Environment Variables

Create `apps/mobile/.env` if overriding defaults. On a physical device, use the LAN IP of the computer running the API — `localhost` on a phone points to the phone itself:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.7:3000
EXPO_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
```

`EXPO_PUBLIC_*` values are inlined when Metro builds the bundle, so restart the dev server after changing them.

> **Note:** JWT tokens are persisted in SQLite (`auth` table) for M4 MVP; `expo-secure-store` is recommended for production key storage.

## Setup & Run

```bash
cd apps/mobile
npm install
npm run start
```

For native builds with MapLibre & background location:

```bash
npx expo prebuild
npx expo run:android
```

### Testing on a physical phone

1. Start the backend with the dev override — without it the API is on an internal Docker network and the phone cannot reach it:

   ```bash
   # from the repository root
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   curl http://<your-lan-ip>:3000/health
   ```

2. Put the phone and the computer on the same Wi-Fi network (not a guest network with client isolation) and set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to `http://<your-lan-ip>:3000`.

3. Start Expo with LAN host mode and scan the QR code:

   ```bash
   npx expo start --host lan
   ```

If `curl http://<your-lan-ip>:3000/health` fails from another device, the problem is the backend/network, not the app. If the phone shows "Unable to send OTP. Check API connectivity.", re-check the URL in `.env`, restart Expo, and confirm the phone can open `http://<your-lan-ip>:3000/health` in its browser.

### Building a LAN preview APK

Android blocks plain HTTP by default, so a standalone APK needs an explicit cleartext opt-in. The `preview` profile in `eas.json` sets `EXPO_PUBLIC_API_URL` to the LAN address and `NOCTOWL_LAN_CLEARTEXT=1`; `app.config.js` uses that flag to add `expo-build-properties` with `usesCleartextTraffic: true` **only for this profile**. Production builds keep Android's secure default.

```bash
cd apps/mobile
npx eas-cli@latest build -p android --profile preview
```

Install the resulting APK with `adb install -r <apk>` or open the build link on the phone. If your computer's LAN IP changes, update `EXPO_PUBLIC_API_URL` in the `preview` profile and rebuild — the URL is baked into the bundle at build time.

## Testing & Typecheck

```bash
cd apps/mobile
npx tsc --noEmit
npm test
npm run test:cov
```
