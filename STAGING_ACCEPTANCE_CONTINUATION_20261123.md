# MYCAR-STAGING Acceptance continuation — 2026-11-23

## Scope
Only `mycar-staging` GitHub repository and Supabase STAGING `dlbshlvyhfwkorooxbnu`. The Production repository/database are untouched.

## Verified on actual Browser / STAGING database from earlier tests
- Record-level Conflict Detection, Keep server, Use my change: PASS.
- RPC Write and revision tracking: PASS.
- Transactional Merge Restore, Private Snapshot, Reverse Restore: PASS.
- Reverse Restore matches all 14 account-specific snapshot rows including payload, tombstones and updated_at: PASS.
- Latest database state after Reverse: account revision 6; 6 operations; 1 retained snapshot; 15 total records, including 4 tombstones.

## Additional tests performed in this continuation
- T13: RPC apply followed by operation-status lookup, representing a lost HTTP response after commit: **PASS in rollback-only SQL**.
- T17: Retry with original request ID returns identical operation result, no extra revision, no duplicate operation: **PASS in rollback-only SQL**.
- T6: Stale revision is rejected without operation persistence: **PASS in rollback-only SQL**.
- Client-side simulated lost HTTP response after apply with successful recovery: **PASS**; exactly one committed write.
- Client-side simulated lost response AND initial status lookup, with later restart/retry: **PASS**; one write only, pending queue subsequently clears.
- Legacy direct write denied after temporary role privilege revoke: **PASS in rollback-only SQL**; **privileges deliberately restored** at transaction rollback.
- Reverse Restore rejected if another RPC write occurs after original Restore: **PASS in rollback-only SQL**.
- Offline edit created before a Restore which left that record's payload unchanged: Restore Barrier triggers conflict, preserves pending and prevents upload: **PASS in client simulation** (previous round).
- Build 2026-11-23.6 fixes premature Reverse Restore button display; initial button visible only when a confirmed restore is stored for the signed-in account.
- Static Source/Build checks: **15/15 PASS**, including JavaScript syntax, staging-only cache, missing-asset detection, mandatory staging client overrides and no Production database reference.

## Database post-test
- 15 rows total, 4 tombstones.
- 6 persisted RPC operations.
- Latest revision 6; 1 pre-restore snapshot.
- `authenticated` retains direct `INSERT` and `UPDATE` privileges on STAGING for now, to avoid stranding old offline clients.

## Browser and cutover gate (NOT verified yet)
1. Deploy Build 2026-11-23.6 through GitHub Actions > Deploy MYCAR STAGING Pages > Run workflow > main. Confirm exact build on Settings.
2. Confirm Reverse Last Restore is **hidden** after previous reverse and fresh reload; Recover Operation Status is still present.
3. Execute genuine browser/network-disconnect-after-commit tests in the client and Restore UI with controlled test accounts. Do not equate simulation with browser acceptance.
4. Validate a second offline device crossing a live Restore barrier. Check queue remains intact and no older data are uploaded automatically.
5. Audit old clients and pending queues before revoking direct write. Test old direct write denied in isolated staging cutover, with a verified rollback procedure and user confirmation.
6. Do not deploy any STAGING changes to Production until all acceptance cases pass.

## Integrity and safety
- No persistent records were created by the additional SQL tests (explicit `BEGIN ... ROLLBACK`).
- Do not clear Browser Storage while pending edits exist.
- Restore UI is merge-only, not a whole-account replacement.
- Old client direct writes remain a known cutover risk and bypass revision tracking.
