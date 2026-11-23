# MYCAR STAGING — Actual uploaded JSON rollback-only restore rehearsal
Date: 2026-11-23
Scope: STAGING Supabase project `dlbshlvyhfwkorooxbnu` only. Production unchanged.

## Input artifact
- `mycar_backup_all_2026-11-23.json` uploaded in conversation.
- Size: 2,779 bytes.
- SHA-256: `1825f1c05284bb1518ced99a2b6a097a5a2b232528acd9a27b72c77309bd9d66`.
- Valid application-format JSON; collections: vehicles=1, fuel=5, maintenance=1, tax=2, trips=1, other=1.
- Total active entries: 11, no duplicate (collection,id) identifiers, no unresolved vehicleId relationships.
- File does NOT contain tombstones, the server revision, RPC operation history or an entire multi-account database backup.

## Rehearsal method
- Independently inspected `mycar_restore_preview`, `mycar_restore_merge` and `mycar_reverse_restore` SQL implementation.
- Converted 11 uploaded app-format entries to exactly the 11 `{collection,record_id,payload,deleted:false}` entries expected by the staging RPC, matching the client converter.
- Reconstructed the SQL input from the uploaded JSON (not a newly exported server file).
- Executed **BEGIN; DO ...; ROLLBACK;** on STAGING with simulated authenticated account context; no persistent new records.
- Asserted each of the 11 uploaded payloads and record IDs exactly matched active records for the test account; 11/11 matched.
- Asserted Preview was `merge-only`, revision 20 and count 11.
- Performed transactional restore to revision 21, created a private pre-restore snapshot, and checked same number of overall account rows and preserved tombstones.
- Immediately reversed that restore to revision 22 within same outer transaction, confirmed entire account snapshot **including tombstones and updated_at timestamps** matched its original JSONB row-set byte-for-byte semantically.
- Checked exactly two operation audit entries existed inside transaction.
- **ROLLBACK** reverted all trial writes, snapshot, operations and revisions.

## Post-rehearsal live verification
| Metric | Before | After |
|---|---:|---:|
| Account revision | 20 | 20 |
| Persisted operations | 20 | 20 |
| Persisted private restore snapshots | 4 | 4 |
| `public.mycar_records` rows | 15 | 15 |
| Tombstones | 4 | 4 |
| QA Fuel liters | 35 | 35 |
| Direct authenticated INSERT/UPDATE | DENIED | DENIED |
| Authenticated SELECT | ALLOWED | ALLOWED |

## Verdict
**PASS: uploaded backup application-restore rehearsal and immediate reverse with full transactional rollback, STAGING only.**

**Important limitation**: This tests merge-only application recovery, **not disaster recovery of the entire Postgres database**. A production-grade DB backup must also preserve tombstones, audit/operations, revisions and users, and be restored in an isolated clone with application compatibility checks.

## Remaining blockers before Production cutover
1. NET-02B genuine physical mid-flight network interruption, still unproven. Browser simulated lost acknowledgement, blocked pre-dispatch and offline queue tests passed separately.
2. Complete production-specific disaster recovery snapshot / clean-isolated-clone restore test.
3. Review SECURITY DEFINER RPC internals and pre-existing `public.rls_auto_enable()` EXECUTE grants; evaluate leaked-password protection.
4. Document Production device inventory, pending queues, backup, migration rollback and receive explicit Production cutover approval.

No production resources were accessed or changed.
