# MYCAR-STAGING — Legacy Direct Write Cutover Gate
Date: 2026-11-23
Environment: Supabase `MYCAR-STAGING` project `dlbshlvyhfwkorooxbnu`, GitHub `mycar-staging` ONLY.
DO NOT run this against Production or copy settings to Production.

## Verified
- STAGING revision 19; 19 RPC operations; 15 records; 4 tombstones; QA Fuel 34 L.
- `authenticated`: SELECT/INSERT/UPDATE on `public.mycar_records`, no DELETE.
- `anon`: no SELECT on `public.mycar_records`.
- All five `mycar_*` RPCs: callable by `authenticated`, not by `anon`.
- STAGING application `cloud-sync.js`: reads directly but writes through RPC; static build rejects `resolution=merge-duplicates`.
- Old `mycar` / `develop` client: direct PostgREST UPSERT; **incompatible with revoked direct write**.
- Transactional rollback-only experiment: temporary revoke denies direct insert while authenticated RPC remains functional. Transaction rolled back.

## HARD STOP before permanent REVOKE
These facts CANNOT be determined from the database:
1. Whether an old browser/app/PWA remains installed and in use.
2. Whether that device has unsent data in local storage.
3. Whether users/devices have been told to upgrade or export their pending edits.
4. Whether the staging URL is the only one they use.

The owner's explicit cutover acceptance and verification that all relevant staging devices have Pending = 0 are required before running a permanent revoke.

## Controlled migration (PREPARED ONLY, NOT EXECUTED)
After verifying the STAGING project identity, all clients migrated, no old pending edits, and a current backup:
```sql
BEGIN;
REVOKE INSERT, UPDATE ON TABLE public.mycar_records FROM authenticated;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.mycar_records','INSERT')
   OR has_table_privilege('authenticated','public.mycar_records','UPDATE')
   OR NOT has_table_privilege('authenticated','public.mycar_records','SELECT')
  THEN
    RAISE EXCEPTION 'MYCAR_STAGING_CUTOVER_PRIVILEGE_CHECK_FAILED';
  END IF;
END $$;
COMMIT;
```
**Do not deploy to Production.** Do not revoke SELECT. Server RPCs are SECURITY DEFINER with bounded access; ensure they remain callable only by authenticated users.

## Emergency rollback (PREPARED ONLY, NOT EXECUTED)
Only after a verified STAGING incident and appropriate approval:
```sql
GRANT INSERT, UPDATE ON TABLE public.mycar_records TO authenticated;
```
This immediately reopens the unsafe direct-write bypass. It must be treated as temporary.

## Required post-cutover checks
- Authenticated direct POST and PATCH return 403 / permission denied.
- Authenticated `mycar_get_sync_state` and `mycar_apply_changes` succeed.
- Authenticated table SELECT still succeeds for owner rows and owner RLS is enforced.
- Browser shows `Synced`, Pending 0 after a fresh test edit.
- No extra rows, tombstones, unexpected revisions or operations.
- PWA refresh / installed desktop and phone versions verified.
- Old client shows a clear upgrade path instead of silently retrying and losing locally stored edits.

## Outstanding separate gate
NET-02B true mid-flight physical network interruption is not yet proven. Blocked-request recovery and simulated lost-ack are tested but are not substitutes.

## Current cutover status
**NOT APPROVED / NOT EXECUTED.** The STAGING grants remain unchanged.
