# CareMatch: Shift Arcade — moderation and deletion

Owner: Joey Bidan Studios (Joey Bidan). Public support: joeybidanstudiosupport@gmail.com.

## Daily review

Check the support mailbox and the private `carematch_reports` table every day while online rankings are offered. Investigate reports promptly, prioritizing threats, private information and hate. Store rules require ongoing human moderation; these controls do not review reports for you. Don't promise a response deadline you cannot meet. Reports contain a selected reason, not public messages. A player's report does not automatically impose a ban.

Open https://supabase.com/dashboard/project/blefujvmurpkgmiazbiq/editor and run:

```sql
select id, alias, reason, created_at, status
from public.carematch_reports
where status = 'open'
order by created_at;
```

Inspect the reported alias and score history; do not treat the number of reports as proof. There are no chat messages or actual patient records in this game. Alias restrictions affect every installation choosing that name because names are not reserved identities. If stronger identity-based moderation is needed, add authenticated player IDs before adding social/chat features.

## Restrict an alias

Replace the example alias and note after reviewing the report:

```sql
select public.carematch_moderate_alias(
  'EXAMPLE', 'ban', 'Reviewed offensive alias; support appeal available'
);
```

The restriction immediately excludes that alias from online rankings, rejects new online rounds under it, prevents pending round submission, and marks its open reports resolved. Cached boards on other devices update when they refresh; a player's Block action hides the alias immediately on their device. Bans are not applied merely because a report was submitted. If the cache contains obvious profanity, the app also filters it locally.

## Lift a restriction or dismiss a report

```sql
select public.carematch_moderate_alias('EXAMPLE', 'unban', 'Reviewed appeal; restriction lifted');
select public.carematch_moderate_alias('EXAMPLE', 'dismiss', 'Reviewed; no rule violation found');
```

To resolve one report without touching others, use its exact UUID in Table Editor or an SQL UPDATE restricted to that ID. Keep moderator notes brief; do not add unnecessary private information. Reviewed reports are cleaned 90 days after review. Open reports remain until reviewed; bans remain until lifted.

## Player deletion

The updated app has a confirmation flow in Privacy & Support → Delete my game data. It proves ownership with a random installation secret; the server stores only its hash. The public API can delete only rounds associated with the supplied installation key. Deleting a round cascades to its saved score. Reports submitted by that installation are also removed. A shared alias does not give deletion rights over another installation's scores.

No account or email sign-in is created. Players should delete through the app before clearing app storage or uninstalling; losing the key removes the automatic deletion proof. Old v1.1 records lack an installation hash and require support-assisted verification. Do not accept an alias alone as proof of ownership. Request approximate dates/scores and review evidence without asking for passwords or private device keys by email. If ownership cannot be established, explain the limitation and avoid erasing unrelated users' records.

For a verified support request, inspect only relevant records:

```sql
select s.round_id, s.alias, s.score, s.submitted_at
from public.carematch_scores s
where s.alias = 'VERIFIED_ALIAS'
order by s.submitted_at desc;
```

After verifying the exact round IDs, remove only those rounds in Table Editor. Their scores are removed automatically. Do not delete all records with a shared alias unless ownership of every affected record is verified. Avoid exporting private round or installation hashes. Provider backups/logs follow their retention settings; live-table deletion cannot purge external snapshots or players' screenshots. Explain any retained safety restriction.

## Maintenance

The scheduled `carematch-hourly-privacy-cleanup` job runs hourly at minute 17. It calls the restricted `SECURITY INVOKER` function `carematch_cleanup`. API requests call the same cleanup as a fallback. It clears IP hashes older than 24 hours, expired rounds without scores, and reports reviewed more than 90 days ago. Scores and scored rounds remain for all-time rankings until deletion or moderation removal.

```sql
select jobname, schedule, active from cron.job
where jobname = 'carematch-hourly-privacy-cleanup';
```

If the shared Supabase project is paused, online rankings, reports and deletion are unavailable until it resumes. Offline play and local blocking still work.

Never put secret/service-role keys in the APK or public webpages. All moderation database functions are inaccessible to `anon` and `authenticated`. There is no public moderation action in the Edge Function.
