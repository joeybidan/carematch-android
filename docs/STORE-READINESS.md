# Priority 2 — implementation and review record

App: **CareMatch: Shift Arcade**, Joey Bidan Studios. Updated October 11, 2026.

## Public URLs

- Privacy: https://ctsdocutool.netlify.app/carematch/privacy.html
- Terms & Player Rules: https://ctsdocutool.netlify.app/carematch/terms.html
- Support & external deletion: https://ctsdocutool.netlify.app/carematch/support.html
- Contact: joeybidanstudiosupport@gmail.com

These are standalone, publicly accessible HTML pages, copied identically into this game's APK and the existing DocuTool site's `public/carematch` folder. They describe only the standalone game. Changing this app's bundled files does not automatically update the hosted copies; keep the two sets identical when policies change.

## Implemented

- Explicit versioned rules acceptance before starting online rounds or sending reports; offline play and deletion do not require acceptance.
- Shared client/server alias filtering; server checks prevent bypassing the UI; rendering filters obvious prohibited cached aliases.
- In-app report reasons, server confirmation/failure feedback, private database queue, duplicate suppression and network/device rate limiting.
- Alias blocking/unblocking saved on device, cached-row filtering and server ranking exclusions so other entries can fill the list.
- Reviewed restrictions enforced for rankings, round start, pending submission and later retries; private dashboard moderation functions.
- Installation-secret based deletion with explicit confirmation, no alias-only authority, cascading score deletion, reporter deletion, cancelled pending uploads, local-state reset and ended current game.
- Public external deletion instructions and support email for older versions/lost keys.
- Hourly privacy cleanup with API-request fallback.
- Version 1.2 / Android versionCode 3, updated app label, bundled policies and Capacitor sync.

## Validation

Node test suite: 14 passing tests. Coverage includes engine parity/replay, forged score rejection, ticket ownership, idempotency, offline queue handling, client/server policy parity, abusive aliases and obfuscation, consent version, structured reports, bounded blocks, deletion authorization and storage reset.

Live Supabase API: verified ranking reads, consent enforcement, abusive-name rejection, completed score replay, private report receipt, deduplication, exclusion of a blocked alias, rejection of another installation's deletion authority, own round/report deletion and rejected replay after deletion. Temporary QA records were deleted. Separate rollback-only SQL validation checked moderator ban/unban, ranking exclusion, ticket enforcement, report rate limiting, and retention cleanup. Live grants show every CareMatch function is SECURITY INVOKER and inaccessible to anonymous/signed-in client roles; CareMatch tables have RLS and server-only permissions. Hourly cleanup is active. Supabase security advisors found no new CareMatch warnings; pre-existing findings relate to DocuTool visit tracking and unused Auth configuration.

Public pages: HTTPS 200 responses, HTML content type, correct game identity and support contact. Rendered web QA: Playwright at http://127.0.0.1:5173/ with 393×852 and 1280×800 viewports. Browser plugin not available; the runtime Chromium download was blocked, so a temporary Chromium binary supplied through npm was used without changing repo dependencies. Sixteen checks passed: page identity, meaningful screen, no publishing before consent, bundled policy dialog, immediate/persistent blocks, unblock/report workflow, consented online start, deletion/reset, client offensive filtering, offline play, both viewport widths, no framework overlay and no app console exceptions. UI API responses were deterministic test doubles; separate live API tests above verified production behavior. Internal screenshots support the layout check and are not committed. This does not certify the native Android/iOS packages or guarantee store approval.

## Required before store submission

1. Rebuild and install v1.2 on an actual phone using the existing signing key; don't uninstall merely to update. Test online gameplay/save on two devices, offline policy viewing, report/block/unblock, deletion success/failure, and return from support email/browser links. This is Priority 3/native quality testing.
2. Assign daily report/mailbox review to Joey or another trusted moderator using [MODERATION.md](MODERATION.md). Working report controls do not replace ongoing human review.
3. Online rankings currently target ages 13+. Choose store target-audience and age-rating answers consistent with this. Distribution intended for younger children needs a separate review/design.
4. Complete accurate Google Data safety and Apple App Privacy forms for the final binary, including aliases, scores/gameplay, installation identifiers, report data and provider diagnostics as applicable. Do not select “no data collected.” This version has no ads or tracking SDK, and no user-facing account creation.
5. Check final provider log/backup retention and complete any store privacy fields required for them. Published notices distinguish live-data deletion from provider backups and logs; don't promise instant deletion of external snapshots.
6. Build/test signed Android release AAB and a separate iOS application; this repository currently contains Android, not a tested iOS build. Store approval, age ratings and final disclosures remain submission tasks.

Policy sources reviewed: https://support.google.com/googleplay/android-developer/answer/9876937 ; https://support.google.com/googleplay/android-developer/answer/10144311 ; https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/app-store/app-privacy-details/ . Policies are dated sources, not a guarantee of approval.
