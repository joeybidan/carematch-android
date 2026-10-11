# Android quality testing — October 11, 2026

## Status

Priority 3 is in progress. Eleven functional checks passed on one physical device across two rounds. Broader device coverage and the signed release binary are not yet verified.

## Evidence and scope

- Tester: Joey Bidan.
- Device: Infinix GT30 Pro.
- Test date: October 11, 2026 (Asia/Manila).
- Evidence: tester's direct report in the project conversation; no screenshots or native logs supplied.
- APK: newly downloaded and installed APK in the v1.2 testing workflow. Exact binary hash, signing certificate, installed version, and Android OS version were not independently verified.
- Source context: v1.2 / versionCode 3 at commit 81b9c7c2e27dfa34adaeabefc9a8e19ef1ffd343. This is source context, not proof of binary identity.
- These are user-reported physical-device results, not agent-executed emulator results.

## Reported functional results

| Check | Result |
| --- | --- |
| Complete game | Pass |
| Home and return | Pass |
| Lock and unlock | Pass |
| Offline gameplay and policy pages | Pass |
| Online score submission | Pass |
| Block and unblock | Pass |
| Delete test data | Pass |
| Support links and return to the app | Pass |
| Disconnect during an online round and reconnect | Pass |
| Back navigation, rotation, and larger text | Pass |
| Longer gameplay | Pass |

No issue was reported in these checks. Report submission/delivery was not one of the eleven checked items. The second round was reported at 23:01 on October 11, 2026 (Asia/Manila); exact session duration and device temperature were not measured. Earlier feedback confirmed the Terms checkbox and Privacy & Support interface appeared satisfactory.

## Remaining Android checks

1. Report receipt: validate a controlled report against the tester's own test alias and confirm its receipt in the private moderation queue. Do not generate false reports against unrelated players.
2. Deletion failure path: verify offline/server failure feedback preserves deletion authority and allows retry after reconnection, using disposable test data.
3. Second Android device: repeat installation, launch, gameplay, policy access and online score submission on a different device/screen size, preferably an older or lower-powered phone when available.
4. Signed release build: build the store-targeted signed Android release and repeat core checks. A debug APK pass alone does not validate the final release.
5. Confirm installed app version, Android OS version, and final release artifact identity when collecting the release record.

## Execution environment

No adb executable was available in the agent workspace when this record was created. No emulator session or native log capture was performed by the agent in this turn. Source inspection was used only to tailor the remaining instructions.

See [STORE-READINESS.md](STORE-READINESS.md) for the broader submission checklist and [MODERATION.md](MODERATION.md) for report review operations.
