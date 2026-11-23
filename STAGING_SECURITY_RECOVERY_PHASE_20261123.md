# MYCAR-STAGING — Next Phase Security & Recovery Readiness
Date: 2026-11-23
Project ID: `dlbshlvyhfwkorooxbnu`
Production: unchanged

## Completed — Security hardening
- Live SQL review of `mycar_apply_changes`, `mycar_get_sync_state`, `mycar_restore_preview`, `mycar_restore_merge` and `mycar_reverse_restore`.
- Verified 5 RPCs use authenticated `auth.uid()`, account-scoped data/operations and revision fencing, `search_path=pg_catalog`, bounded input size, and authenticated execute grants only.
- Historical pre-existing `public.rls_auto_enable()` was a SECURITY DEFINER event trigger and unnecessarily executable by anonymous/authenticated roles.
- A rollback-only rehearsal revoked its EXECUTE grants; created a temporary public QA table to verify DDL event trigger still enables RLS; removed the table, then rolled back.
- Applied permanent **STAGING-only** migration `mycar_staging_restrict_rls_auto_enable_execute_20261123`: `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;`
- Verified anonymous and authenticated can no longer EXECUTE it, existing enabled event trigger remains active.
- Re-ran Supabase Security Advisor: anonymous SECURITY DEFINER warning removed; remaining 5 *authenticated* SECURITY DEFINER warnings are intentional MYCAR RPCs; leaked password protection remains disabled in Auth.
- [Supabase linter 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Verified database unchanged
- Revision: **20**
- Operations: **20**
- `public.mycar_records`: **15**
- Restore snapshots: **4**
- Direct authenticated `INSERT/UPDATE`: **DENIED**

## Recovery clone assessment
- `MYCAR-STAGING` project is **ACTIVE_HEALTHY**.
- `list_branches`: **no development branches exist**.
- New Supabase branch may incur hourly compute charges and, by default, **copies migrations but does not clone production/staging data**. A successful branch creation would therefore **not by itself constitute a complete database restore test**.
- No billable branch or new project created.
- A true disaster-recovery drill requires an independently provisioned clone plus a database backup containing auth/users, state/revision, operations, tombstones, triggers, and private snapshots, followed by a referential and functional audit.
- Last uploaded JSON file is app-level active records only, not a whole-database backup.

## Outstanding test
**NET-02B genuine mid-flight interruption remains OPEN.** Existing browser tests proved:
- Offline-before-send -> replay PASS.
- Chrome Request conditions Block -> unblock PASS.
- Simulated after-commit lost-ack -> request ID recovery PASS.
No observation yet proves a physical network disconnect while a POST is actively in flight.

## Safe NET-02B execution guide
1. On STAGING desktop only, verify Build 2026-11-23.7 and Pending 0, and capture current revision and test Fuel amount; do not guess values.
2. DevTools Network: Keep log, Fetch/XHR, optionally use the currently proven exact URL Request conditions rule with a **throttled, not blocked** preset and verify `affected` increments. This rule only matters if confirmed to match.
3. Save one change to QA Fuel and verify actual `mycar_apply_changes` shows pending. Only then physically disconnect using device network switch / DevTools Offline before request response completes; capture screenshot of request and event time. If a 200 already arrived, do not call it NET-02B.
4. Capture Pending and diagnostics while offline. Do not clear browser storage, restart app or change more records.
5. Reconnect; check recovery and inspect the current `request_id` and server operation status in STAGING; expect at most one committed operation, pending 0, no stored flight, and latest payload matches.
6. Ambiguous client/server timings are **INCONCLUSIVE**, not PASS.
7. Avoid blindly repeating Fuel updates to force a timing race; stop and inspect after one attempt.

## Production cutover status
**NOT AUTHORIZED.** Still need genuine midflight test, an isolated full-database DR clone and end-to-end recovery, an Auth password setting decision, review of RPC details/operational rollout, and an explicit separate Production authorization.
