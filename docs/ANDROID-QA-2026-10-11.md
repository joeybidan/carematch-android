# Android quality testing — October 11, 2026

## Status

Priority 3 is in progress. Thirteen checks were reported as passing on one physical device across three rounds. Twelve functional checks passed according to the tester; the report screen displayed success, but matching that phone's report to a persisted backend record remains pending. Broader device coverage and the signed release binary are not yet verified.

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
| Offline deletion failure and successful connected retry | Pass |
| Report submission | Success shown (tester reported); backend association pending |

No issue was reported by the tester in these checks. The third round was reported at 23:19 on October 11, 2026 (Asia/Manila): offline deletion/retry passed, and reporting displayed “Report received.” The reported alias was not supplied. The second round was reported at 23:01 on October 11, 2026 (Asia/Manila); exact session duration and device temperature were not measured. Earlier feedback confirmed the Terms checkbox and Privacy & Support interface appeared satisfactory.

## Remaining Android checks

1. Phone report association: identify the reported alias and whether game data was deleted after reporting. If necessary, repeat a controlled report against the tester's own alias and verify its receipt before deletion. Do not generate false reports against unrelated players.
2. Second Android device: repeat installation, launch, gameplay, policy access and online score submission on a different device/screen size, preferably an older or lower-powered phone when available.
3. Signed release build: build the store-targeted signed Android release and repeat core checks. A debug APK pass alone does not validate the final release.
4. Confirm installed app version, Android OS version, and final release artifact identity when collecting the release record.

## Additional live report verification

At approximately 23:20 Asia/Manila, the private reports table contained zero rows, checked with the postgres role. No report could therefore be matched to the phone submission at that time. Deletion of game data also deletes reports made by that installation; whether deletion followed the phone report is not yet known.

A separate isolated live API check at 23:21 used the agent's disposable test identity and alias QA20261011. The public report endpoint returned HTTP 200 with reported=true and report ID 3455e0be-6f5f-4754-8e9b-c48d605dc7e4. An SQL read independently confirmed that exact row in the private queue with status open. The public deletion endpoint for the same isolated test identity returned HTTP 200, deleted=true, reportsRemoved=1; a follow-up SQL read confirmed zero remaining rows for that report ID. The temporary test identity file was removed. No player data or unrelated report was altered.

The deployed Edge Function includes the report RPC, and the live database report/cleanup functions were inspected. These checks validate the backend report-saving/deletion path independently; they do not establish receipt of the phone's particular report or imply an app defect.

## Execution environment

No adb executable was available in the agent workspace when this record was created. No emulator session or native log capture was performed by the agent in this turn. Source inspection was used only to tailor the remaining instructions.

See [STORE-READINESS.md](STORE-READINESS.md) for the broader submission checklist and [MODERATION.md](MODERATION.md) for report review operations.
