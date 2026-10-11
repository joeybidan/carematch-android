# Android quality testing — October 11, 2026

## Status

Priority 3 is in progress. The initial seven functional checks passed on one physical device. Broader device coverage and the signed release binary are not yet verified.

## Evidence and scope

- Tester: Joey Bidan.
- Device: Infinix GT30 Pro.
- Test date: October 11, 2026 (Asia/Manila).
- Evidence: tester's direct report in the project conversation; no screenshots or native logs supplied.
- APK: newly downloaded and installed APK in the v1.2 testing workflow. Exact binary hash, signing certificate, installed version, and Android OS version were not independently verified.
- Source context: v1.2 / versionCode 3 at commit 81b9c7c2e27dfa34adaeabefc9a8e19ef1ffd343. This is source context, not proof of binary identity.
- These are user-reported physical-device results, not agent-executed emulator results.

## Initial functional results

| Check | Result |
| --- | --- |
| Complete game | Pass |
| Home and return | Pass |
| Lock and unlock | Pass |
| Offline gameplay and policy pages | Pass |
| Online score submission | Pass |
| Block and unblock | Pass |
| Delete test data | Pass |

No issue was reported in these checks. Report submission/delivery was not one of the seven checked items. Earlier feedback confirmed the Terms checkbox and Privacy & Support interface appeared satisfactory.

## Remaining Android checks

1. External handoff: open Email support without sending a message, confirm the destination address, return to the app; open Support & deletion webpage and return.
2. Network interruption: start an online round while connected, disconnect, finish and save, then reconnect and tap Refresh. Confirm pending submission retries and no duplicate score is created. A round started offline remains local; it is not expected to become a global score.
3. Display and navigation: test system Back in a policy dialog; rotate the phone; temporarily increase the system font size. Verify controls and text remain accessible, then restore settings.
4. Sustained use: play for 15–20 minutes and repeat opening/closing panels. Record visible lag, freezes, crashes, or unusual heat. This is an observational check, not a measured performance benchmark.
5. Report receipt: validate a controlled report against the tester's own test alias and confirm its receipt in the private moderation queue. Do not generate false reports against unrelated players.
6. Deletion failure path: verify offline/server failure feedback preserves deletion authority and allows retry after reconnection, using disposable test data.
7. Second Android device: repeat installation, launch, gameplay, policy access and online score submission on a different device/screen size, preferably an older or lower-powered phone when available.
8. Signed release build: build the store-targeted signed Android release and repeat core checks. A debug APK pass alone does not validate the final release.
9. Confirm installed app version, Android OS version, and final release artifact identity when collecting the release record.

## Execution environment

No adb executable was available in the agent workspace when this record was created. No emulator session or native log capture was performed by the agent in this turn. Source inspection was used only to tailor the remaining instructions.

See [STORE-READINESS.md](STORE-READINESS.md) for the broader submission checklist and [MODERATION.md](MODERATION.md) for report review operations.
