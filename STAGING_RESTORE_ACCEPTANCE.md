# MYCAR STAGING — Restore & Reverse Restore Acceptance Plan

Environment: **MYCAR-STAGING only** (project `dlbshlvyhfwkorooxbnu`). Do not modify Production.

## Current implementation
- Merge-only server Restore with read-only Preview and revision-bound confirmation token.
- Server creates a private pre-Restore snapshot containing all records including tombstones.
- Reverse Restore requires the immediately following account revision.
- Restore/Reverse guarded by account-scoped RPC locking and revision compare-and-swap.
- Client refuses Restore while Offline, Sync busy, Pending Queue not empty, or Conflict unresolved.
- Client tracks a Restore barrier revision to stop stale offline changes from crossing Restore silently.
- UI preserves request IDs for uncertain network failures; Recover Operation Status checks the same request ID.
- Legacy JSON import path remains disabled in STAGING.

## Tested without persistent mutations (2026-11-23)
- Postgres Restore Preview → Merge → Reverse, exact snapshot checksum verification, in a transaction explicitly ROLLBACKed: PASS.
- Restore and Reverse both advance restore_barrier_revision in a rollback-only transaction: PASS.
- Browser-client simulated stale offline queue encountering a Restore barrier, even for an unchanged record: conflict shown; no automatic server write.
- Staging source checks: JavaScript syntax, required UI controls, build script assertions, isolated PWA cache, no embedded Production project URL: PASS.

## Next browser test sequence — use synthetic STAGING records only
1. Run GitHub Actions **Deploy MYCAR STAGING Pages** on `main`, then verify **Build 2026-11-23.5** appears in Settings.
2. Confirm `Pending records = 0`, `Synced`, and the correct STAGING URL.
3. Click **Export Backup (JSON)** with **All records** selected; keep a copy of that test-only file.
4. Under **STAGING · Transactional RPC Restore**, select the exported file and click **Preview on STAGING Server**.
5. Confirm the Preview explicitly says **MERGE ONLY**, shows record count and current Revision; **do not click Confirm Merge Restore** until the Preview is reviewed and the record counts are checked.
6. To test actual Restore, use a separately prepared synthetic STAGING-only file, change one safely identifiable test record, type `RESTORE`, and explicitly confirm. Check Revision increases by exactly one and that no unrelated records/tombstones disappear.
7. Without any other writes, test **Reverse Last Restore**; verify the original exact server snapshot is restored and Revision increases by one.
8. While a second device has a pending Offline change from before Restore, verify the Restore barrier requires a conflict decision and never silently uploads the old pending record.

## Important limits
- A Restore is **merge-only**, not a full-account replacement. Records absent from the file and tombstones are retained.
- Reverse is rejected if another accounted RPC write occurred after Restore.
- Legacy direct table writes are still enabled during migration. They may bypass revision tracking; therefore **do not claim full production readiness**.
- Live browser acceptance for Restore, Reverse, HTTP-timeout-after-commit and interrupted Offline scenarios remains **unverified** until executed.
- Do not press **Clear All Data** or clear Browser Local Storage as part of Restore testing.
