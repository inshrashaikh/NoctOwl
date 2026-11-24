# NoctOwl Mobile App

Offline-first React Native (Expo) companion app with SQLite queueing, background GPS tracking, MapLibre visualization, and Socket.IO realtime updates.

## Environment Variables

Create `apps/mobile/.env` if overriding defaults:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
```

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

## Testing & Typecheck

```bash
cd apps/mobile
npx tsc --noEmit
npm test
npm run test:cov
```
