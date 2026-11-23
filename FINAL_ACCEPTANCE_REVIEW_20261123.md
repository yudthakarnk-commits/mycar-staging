# MYCAR STAGING — Final Acceptance Review (NOT Production Cutover Approval)

**As of:** 2026-11-23  
**Scope:** GitHub `yudthakarnk-commits/mycar-staging`; Supabase `MYCAR-STAGING`, project `dlbshlvyhfwkorooxbnu`.  
**Production:** Not modified by this review.  
**Decision:** **STAGING ACCEPTANCE — CONDITIONAL PASS / PRODUCTION CUTOVER — NOT READY**.

## 1. Live database facts (verified read-only)

| Metric | Verified value |
|---|---|
| Account max revision | **20** |
| Persisted operations | **20** |
| Rows in `public.mycar_records` | **15** |
| Tombstones (`deleted=true`) | **4** |
| Distinct data accounts | **2** |
| QA Fuel record (10,409 km) | **35 L** |
| Private restore snapshots | **4**, each containing JSON array |
| Snapshot rows saved across events | **56** total; not 56 distinct records |
| Pre-RPC static backup | **11 rows**, including 4 tombstones; historical only |

Two user devices (Windows desktop and iPhone) were expressly reported to be Build `2026-11-23.7`, Synced, Pending 0. The browser post-lockdown RPC write was observed and independently confirmed as an operation `apply`, revision **19→20**, QA Fuel **34→35 L**.

## 2. Security posture (verified read-only)

| Check | Result |
|---|---|
| Direct authenticated INSERT | **DENIED** |
| Direct authenticated UPDATE | **DENIED** |
| Direct authenticated DELETE | **DENIED** |
| Authenticated SELECT | Allowed with owner RLS on `mycar_records` |
| Anonymous SELECT | Denied |
| `mycar_*` RPC execution by authenticated | Allowed |
| `mycar_*` RPC execution by anonymous | Denied |
| Private `mycar_secure` schema USAGE by authenticated/anon | Denied |
| Private restore snapshot SELECT by authenticated/anon | Denied |
| `mycar_records` RLS | Enabled |

RPCs are `SECURITY DEFINER` owned by `postgres`; their implementation and authenticated owner mapping need independent code/security review before Production migration.

**Additional preexisting security item:** `public.rls_auto_enable()` is an enabled DDL event-trigger function, `SECURITY DEFINER` and executable by `anon` and `authenticated`. Because event-trigger functions are special and ordinarily cannot be called directly, this should be reviewed in security context rather than automatically classified as exploitable. Its EXECUTE grants should be tightened if independent validation supports this. **Not modified here.**

## 3. Evidence-backed acceptance matrix

| Case | Evidence | Status |
|---|---|---|
| Conflict detection and Keep server / Use my change | Browser screenshots and earlier DB checks | PASS |
| Restore Preview read-only | Browser result; DB row/revision unchanged | PASS |
| Merge Restore / Private snapshot | Browser commit; DB 1 extra op/snapshot | PASS |
| Reverse Restore exact restoration | Account-specific snapshot comparison 14/14, 0 mismatches | PASS |
| Offline queue crossed Restore barrier | Browser conflict; server was unchanged | PASS |
| Keep server after Restore conflict | Pending 0; DB revision unchanged | PASS |
| Lost acknowledgement AFTER commit | One-shot browser simulation; request recovery; DB exactly 1 write | PASS — SIMULATED |
| Offline → online recovery | Browser and DB check | PASS |
| Blocked `mycar_apply_changes` → unblock and retry | Chrome request conditions; DB one post-recovery commit | PASS |
| Direct writes revoked; new RPC client works | Persistent STAGING revoke + browser write; DB revision 19→20 | PASS |
| Direct read preserved and anon access denied | Role grants checked | PASS |
| Real mid-flight network disconnection | Earlier attempts completed with 200 before disconnect | **OPEN** |
| Latest app-format backup + merge/reverse rollback rehearsal | Uploaded 11 active records exactly checked; restore/reverse within rolled-back transaction | **PASS — APP DATA ONLY** |
| Production deployment rollback & compatibility | Not performed | **OPEN** |
| Repeat security-advisor review of Production-target DDL/RPC | Not completed | **OPEN** |

**Do not count test simulations as live physical-network tests.**

## 3A. Security Advisor — live STAGING scan

Read-only Supabase Security Advisor executed 2026-11-23T14:37:44Z. Three warning categories:

1. **Public can execute SECURITY DEFINER**: `public.rls_auto_enable()` has `anon` EXECUTE. This function is a preexisting enabled `ddl_command_end` event-trigger handler. Its direct API invocation may fail because event-trigger functions have special invocation semantics, but the exposed EXECUTE grant is unnecessary unless independently justified. Review and consider revoking `EXECUTE` from `PUBLIC`, `anon`, `authenticated` for this **preexisting** function, after confirming the trigger still runs with its owner privileges.
   - [Supabase advisor 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
2. **Authenticated can execute SECURITY DEFINER**: 6 findings — the 5 account-scoped MYCAR RPCs deliberately require `authenticated` access, plus the preexisting `rls_auto_enable()`. These are warnings, **not proof of a vulnerability**. Preserve the five RPC grants pending focused security review of their SQL, `auth.uid()` behavior, locking and explicit input constraints.
   - [Supabase advisor 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
3. **Leaked Password Protection Disabled** in Supabase Auth. Consider enabling after reviewing feature availability and authentication impact.
   - [Supabase Auth password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

**No grant or auth setting was changed as part of this scan.**

## 4. Risk register / blocking gates

1. **Mid-flight connection loss (NET-02B):** must interrupt a genuine outstanding `mycar_apply_changes` request, then record whether it committed, persistent request ID, revision, operation count and pending state. An ambiguous result stays INCONCLUSIVE; do not blindly change Fuel repeatedly.
2. **Latest full-account backup:** Export **All records** from the current STAGING app and verify JSON and independent restore dry run. The fixed pre-RPC 11-row backup is outdated and cannot be treated as full current recovery coverage. Merge-only restore does not delete omitted rows/tombstones.
3. **Production transition design:** STAGING and Production must use separate Supabase projects, isolated PWA caches and properly restricted keys. A staging green test does not authorize copying data, keys or code to Production.
4. **Security review:** inspect SECURITY DEFINER search paths, owner-scoped auth, RLS/policies, advisory locking, operation idempotency, input size controls, and the preexisting `rls_auto_enable` event trigger. Supabase security advisor should be rerun.
5. **Operational rollout:** prepare a tested rollback plan, full-account current backup, outage communications and verify that all live Production clients and pending queues are migrated. The STAGING user confirmed only two STAGING devices, not Production inventory.
6. **UI QA:** Previous stale red `Cloud sync failed` toast after recovery was observed while latest diagnostics `lastError=null`; consider improving toast lifecycle, and ensure diagnostic/test-only controls cannot leak into Production.

## 5. STAGING lockdown rollback (emergency, not executed here)

A **STAGING-only** emergency rollback, if explicitly authorized, is:

```sql
GRANT INSERT, UPDATE ON TABLE public.mycar_records TO authenticated;
```

This reopens bypass writes and must only be temporary. Keep the owner RLS and current RPC backup safe. Do not apply this to Production.

## 6. Recommended next steps

1. Obtain and **inspect a current full-account JSON backup** from STAGING on both-device healthy state; retain it outside browser storage.
2. Complete NET-02B physical mid-flight testing with verified network logs and DB revision accounting.
3. Perform security-advisor review and address any actionable findings.
4. Prepare Production-specific migration and rollback plan but **do not execute** until separate approval.

## 6A. Uploaded latest backup rehearsal — completed
An application-format backup of **11 active records**, SHA-256 `1825f1c05284bb1518ced99a2b6a097a5a2b232528acd9a27b72c77309bd9d66`, was uploaded. The 11 payloads were checked against current STAGING. In a single SQL transaction, the 11 entries were previewed, merged, immediately reversed and compared with the exact previous account snapshot, including tombstones and timestamps. The transaction was **rolled back**; persisted revision 20, operations 20, snapshots 4, records 15, tombstones 4 and test Fuel 35 L remained unchanged. **Application Backup / Merge/Reverse Rehearsal: PASS.** This does **not** constitute a full database disaster recovery test. See [rehearsal record](STAGING_UPLOADED_BACKUP_ROLLBACK_REHEARSAL_20261123.md).

## 7. Final review disposition

**STAGING RPC, application-backup merge/reverse and rollback safety tests: largely PASS.**  
**Legacy Direct Write Lockdown: PASS on STAGING, persistent.**  
**Production Cutover: BLOCKED pending NET-02B, full database disaster recovery test, code/security review, and Production-specific rollback plan.**

No Production files, credentials, data or database grants were touched by this report.
