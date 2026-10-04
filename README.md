# CareMatch Android

Standalone CareMatch project extracted from DocuTool without removing or changing the original CareMatch inside DocuTool.

## Current build

CareMatch runs by itself using Vite + React, wrapped as an Android app with Capacitor. Its application ID is `com.joeybidan.carematch`.

The gameplay rules are copied from the existing DocuTool CareMatch engine. Version 1.1 adds shared weekly and all-time Top 5 rankings, while keeping an on-device scoreboard and offline gameplay. The icon and Joey Bidan Studios intro passed the user's physical-phone test.

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
npm.cmd ci
npm.cmd test
npm.cmd run build
npx.cmd cap sync android
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

This repository has its own source and Android project. It uses dedicated `carematch_rounds` and `carematch_scores` tables plus the `carematch-api` Edge Function in Supabase project `blefujvmurpkgmiazbiq`. No DocuTool build, web deployment, Auth configuration changes, or edits to DocuTool's existing tables are needed. The two apps share that project's availability and resource limits.

### Global leaderboard behavior

- Start a round while connected to obtain a server-issued seed and a private round ticket. The app labels the round as eligible for global rankings. No email, password, or account creation is shown.
- Complete the round and tap **Save Score**. A local copy is saved first. The server replays the recorded moves using the identical game engine and computes the score itself; unfinished, invalid, or altered submissions are rejected. Repeated submissions of the same round cannot create duplicate records.
- **This week** and **All time** show the five highest best scores per alias. Ties go to the score accepted first. Aliases are uppercased and aren't reserved identities: two people choosing the same alias share that leaderboard entry. Choose a distinctive name of up to 12 characters.
- Weeks run Monday 12:00 AM to the following Monday in `Asia/Manila`, based on when the server accepts a score. The weekly board rolls over without deleting the all-time history.
- **On device** retains the existing local scoreboard. Clearing it doesn't affect global scores.
- A round started offline remains local-only, even if connectivity returns later. A round started online can queue its completed submission if the connection drops. Up to five pending submissions are stored on this device, valid for 24 hours from the round's start. Reopening the app, reconnecting, or tapping **Refresh / Retry sync** retries them. Expired or invalid tickets remain local only.
- Global scores refresh at startup, when returning to the app, after saving, or on demand. There is no background polling or Realtime subscription. Last downloaded rankings are labelled as cached when disconnected; an expired week's cached scores are cleared on startup.
- Old local scores cannot be uploaded: those rounds have no server-issued ticket or recorded move history.

### Backend maintenance

The live backend is already configured. Pulling this repository and rebuilding the APK requires no keys or SQL pasted into Android Studio. `src/carematch/online-config.json` contains only the public endpoint and publishable key. Server secrets remain in Supabase's Edge Function environment.

The SQL snapshot is in `supabase/migrations/`. It was applied directly through the Supabase SQL connection, independently of the shared project's migration history. It creates only CareMatch resources; do not blindly run `supabase db push` against this shared project or reapply this bootstrap to existing tables. The Edge Function source is in `supabase/functions/carematch-api/`.

Both tables have RLS enabled and no client access. Only the server can call the four CareMatch database functions, all of which use `SECURITY INVOKER`. The API checks the publishable key itself because publishable keys aren't JWTs (`verify_jwt = false` is intentional). Client-provided scores and seeds are never trusted. New rounds are limited to 10 per minute and 200 per day per hashed network address; this is a basic abuse limit, not proof of a human player. A valid move history can still be generated by a bot. No raw IP addresses are stored in CareMatch tables; keyed hashes are cleared after 24 hours when subsequent rounds start, and expired rounds without scores are removed.

After changing game rules, run `npm.cmd run sync:server`, run the tests, and redeploy the Edge Function before distributing a matching APK. Bump `RULES_VERSION` and coordinate the score-table constraint for any incompatible rules change. Don't change the server rules while existing 24-hour tickets are in use without a compatibility plan.

### Verification and physical-phone update

Automated tests cover server replay, forged/unfinished/invalid score rejection, ticket ownership, idempotent retries, shared engine parity, offline queue retries, and expired/rejected tickets. Live tests also verify Supabase grants, per-alias ranking, Philippine week boundaries, rate limiting, and matching independent leaderboard reads. Temporary QA scores are removed after testing.

Rendered QA uses the existing Playwright runtime (Browser plugin unavailable), at `http://127.0.0.1:5173/` with 393×852 and 1280×800 viewports. It verifies page identity, populated screens, no framework overlay or application errors, tab switching, a completed online game and save, offline game/local save, cached ranking messages, and no horizontal overflow. Browser API traffic is forwarded through Node to the live backend because the sandbox browser cannot reach Supabase directly; only the QA browser's request timers are extended to accommodate the relay's latency. Production timeouts remain 4 seconds for a round ticket and 8 seconds for rankings/submission. This does not replace the physical-phone network test. Expected network errors during intentional disconnects are excluded from application-error checks.

Rebuild using the Windows commands above, then copy the new `android/app/build/outputs/apk/debug/app-debug.apk` to your phone and install it over the existing app using the same PC/signing key. Don't uninstall if you want to retain your local scores. Start a new online round, save its completed score, and check it on another device running the updated build. Online functionality on a physical phone must be verified after this update; the earlier APK still has only local scores.

## Remaining phases

1. Rebuild the version 1.1 APK and verify shared rankings on two physical devices.
2. Build and test a signed release APK/AAB.
