# CareMatch Android

Standalone CareMatch project extracted from DocuTool without removing or changing the original CareMatch inside DocuTool.

## Current build

CareMatch runs by itself using Vite + React, wrapped as an Android app with Capacitor. Its application ID is `com.joeybidan.carematch`.

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

## Update the Android app on Windows

In GitHub Desktop, select **carematch-android** and click **Fetch origin**, then **Pull origin** if offered. Open PowerShell in the repository root (the folder containing `package.json`, not the `android` subfolder), then run:

```powershell
npm ci
npm run build
npx cap sync android
```

Open the existing `android` project in Android Studio, allow Gradle sync to finish, select your emulator/device and click Run. A GitHub update alone does not update the APK installed on your phone.

### Verified Windows command-line build

Use the `.cmd` launchers if PowerShell blocks `npm.ps1`. From the repository root:

```powershell
npm.cmd run build
npx.cmd cap sync android
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
Push-Location android
.\gradlew.bat assembleDebug --console=plain
Pop-Location
$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adbPath devices -l
& $adbPath -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk
& $adbPath -s emulator-5554 shell am start -n com.joeybidan.carematch/.MainActivity
```

Replace `emulator-5554` if `adb devices` reports a different serial. The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.

On October 5, 2026, the web build, Capacitor sync, and two Android debug builds passed. The APK was installed on the running `Pixel_8` emulator. The puzzle-heart launcher icon, Joey Bidan Studios intro, and transition into the game were visually verified. Captures and app startup logs are in `artifacts/android-qa/`. No CareMatch crash or JavaScript exception was observed; WebView/graphics warnings and unrelated emulator UWB service crashes appeared in system logs.

The previously reported failure deleting `android/app/build/intermediates` did not recur, so no build folders were deleted or Gradle configuration changed. If it recurs, stop any active Android Studio build, run `.\gradlew.bat --stop` from `android`, pause OneDrive syncing, and retry. A permanent option is a fresh checkout outside OneDrive; reinstall dependencies and sync Capacitor there before building.

No Android Studio clicks are required for this installed build. To run future builds in Studio, open this repository's `android` folder, wait for sync, select the `app` run configuration and `Pixel 8`, then click the green Run triangle.

## App icon and studio intro

- The launcher uses the teal CareMatch puzzle-heart, with adaptive icons and Android 13+ themed-icon support.
- The native splash uses the CareMatch mark on a dark background. Android 12+ uses a compact, masked icon at startup rather than a full-screen poster.
- The bundled Joey Bidan Studios logo appears immediately in the WebView before React loads, stays for a brief studio credit (minimum 1.5 seconds once React starts), then fades into the game.
- Assets are bundled in the APK and work offline. A logo load failure or delay does not prevent gameplay; the React intro has a 4.5-second fallback. Reduced-motion settings disable the loading animation and fade.
- `branding/` contains source images. Generated web assets live in `public/branding/`; Android icon resources live in `android/app/src/main/res/mipmap-*`.

To regenerate assets after changing the source artwork, install Pillow and run:

```powershell
python -m pip install Pillow
python scripts/generate-branding.py
npm run build
npx cap sync android
```

The icon was created with the built-in image generator using this prompt: "Android CareMatch adaptive launcher foreground: a bold teal heart made of four chunky interlocking puzzle tiles; mint highlights, subtle dimensional bevels, transparent background, centered, no text, generous margins, readable at 48 pixels." The studio logo is the supplied Joey Bidan Studios artwork.

## Independence and leaderboard

This repository has its own source and Android project. No DocuTool build or deployment steps are needed. The leaderboard currently uses local storage and has no Supabase connection. Sharing a Supabase account does not couple app code; any future shared database tables or policies would need coordinated changes.

## Remaining phases

1. Repeat launcher icon and startup verification on a physical Android device (Pixel 8 emulator verified).
2. Connect a shared online leaderboard.
3. Build and test a signed APK/AAB.
