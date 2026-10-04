# CareMatch Android

Standalone CareMatch project extracted from DocuTool without removing or changing the original CareMatch inside DocuTool.

## Phase 1

This repository currently runs CareMatch by itself in a browser using Vite + React.

The gameplay rules are copied from the existing DocuTool CareMatch engine. For this first standalone build, the Top 5 is stored locally on the current browser/device. The shared online leaderboard will be connected in a later phase before Android release.

## Run locally

```powershell
npm install
npm run dev
```

Open the local Vite address shown in the terminal, normally:

```
http://localhost:5173/
```

That page should contain CareMatch only.

## Planned next phases

1. Verify standalone browser gameplay.
2. Add Capacitor.
3. Generate the Android project.
4. Open the generated `android` folder in Android Studio.
5. Test on Android emulator/device.
6. Reconnect a shared online leaderboard.
7. Build APK/AAB.
