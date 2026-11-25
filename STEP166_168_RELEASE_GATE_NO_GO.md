# MYCAR Step 166–168: Release Gate — READ ONLY / NO GO
Date: 2026-11-25
Version: `3.5.0-rc.1`
Repository: `yudthakarnk-commits/mycar-staging`; clean preparation branch `prep/production-rc-20261125`.
**This is a cutover readiness record, not permission to deploy.**

## Read-only live environment verification
### Production (Supabase `pteskuyswmwppswzegxp`)
- Live read-only aggregate: **254 records** (253 active, 1 tombstone) across **3 accounts**.
- No Production writes, migrations, privilege revocations, GitHub changes or PWA deployments were executed during these checks.

### STAGING (Supabase `dlbshlvyhfwkorooxbnu`)
- Live read-only aggregate: 15 records, 26 operation logs, 1 account-state row and 4 restore snapshots at audit time. Test data, not Production data.
- Five RPC functions exist: `mycar_apply_changes`, `mycar_get_sync_state`, `mycar_restore_preview`, `mycar_restore_merge`, `mycar_reverse_restore`.
- All five have `anon EXECUTE=false`, `authenticated EXECUTE=true`, `SECURITY DEFINER=true`, and fixed `search_path=pg_catalog`.
- `public.mycar_records`: `authenticated SELECT` only; no INSERT or UPDATE grant. RLS ownership policies contain `auth.uid() = user_id` for SELECT/INSERT/UPDATE (UPDATE has a WITH CHECK).
- Function definition read-only inspection: each RPC resolves caller identity with `auth.uid()` and explicitly rejects null or anonymous identities; operations and record writes are filtered/assigned to that user. This reduces but does **not** eliminate SECURITY DEFINER risk without an authenticated adversarial isolation test.
- Supabase Security Advisor reports five WARN findings for callable SECURITY DEFINER RPC endpoints (intentional API surface requiring audit) plus WARN that leaked-password protection is disabled. See:
  - https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  - https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- **No STAGING schema/data changes** in this read-only audit.

## Completed QA evidence
- Step 165 actual Chromium browser vs fully mocked Supabase: **5/5 PASS**. Run https://github.com/yudthakarnk-commits/mycar-staging/actions/runs/45581032850
- Step 166 additional Chromium tests of Keep Server vs Use Local conflict, tombstone delete and preview auth isolation: **9/9 PASS**. Run https://github.com/yudthakarnk-commits/mycar-staging/actions/runs/45588285882
- Expanded Restore preview/commit/reverse and pending-queue block tests: see current branch run, verify CI outcome before claiming PASS.
- Existing clean RC contains generic RPC Restore client, fail-closed Queue protection and consistent `3.5.0-rc.1` JS/CSS references; STAGING-specific QA client is isolated in `qa/isolated-preview-step164`.

## Hard NO-GO conditions still present
1. **Mixed-version integrity:** Production legacy direct writes are not transactionally coordinated with new RPC revision. Earlier local Custom GUC bypass mechanism is unsafe and must NOT be promoted. Strategy is controlled no-overlap cutover after all devices verified.
2. **User B iPhone:** physical offline queue and last synced state **NOT VERIFIED**. No sign-out/reinstall/clear storage or permission revocation until its data is reconciled.
3. **Production RPC backend is not installed:** no migration has been approved for Production.
4. **Actual STAGING API E2E:** browser QA mocked endpoints; real authenticated REST/RPC write, tombstone, restore and reversal still need dedicated test account and controlled test records.
5. **Device PWA acceptance:** Windows Chromium/Edge PWA, Android, iPhone Safari/Home Screen PWA need physical checks (offline edits, reload while pending, reconnect, wrong-account access, export/import backup, restore/reverse).
6. **PWA assets and public origin:** clean preparation branch's icon references still point at unavailable PNG assets within this STAGING repository. Supply verified icon assets. Avoid serving preview on same `github.io` origin as Production. No publicly deployed isolated preview exists.
7. **Supabase security advisories:** investigate five intentional definer API access warnings and consider leaked-password protection configuration; verify RLS with an actual non-owner token, not just source inspection.
8. **Recovery and rollback:** fresh Production backup at cutover; authenticated session recovery, DNS/Pages cache behavior, restored data consistency and full Supabase Auth service recovery need acceptance proof.

## Device verification gate (one row per device)
Capture: account (Owner / User A / User B), OS and app installation type, app version and browser URL, local Pending count, last successful Sync, remote record count/last update snapshot, exported full JSON backup stored safely, no unresolved conflicts/flight, final owner confirmation.

**Never request the user to send passwords or session tokens.** Never upload real user backups to STAGING.

## Cutover sequence only after every gate passes
1. Coordinate all users; stop edits and reconcile pending count = 0 on every device; save separate local full backups.
2. Take fresh Production `public` and `auth` backups and test restoration.
3. Explicitly approve exact rollback window and cutover commands; do not assume prior generic approval.
4. Deploy verified RPC database changes and production client under approved change control, with verified server data and sessions.
5. Verify accounts independently, old clients retired, no mixed-version writes; then restrict Legacy Direct Write.
6. Validate end-to-end record counts, tombstones, idempotency, restore and multi-device readbacks; document release signoff and rollback.

**Release decision: NO GO. No Production mutation authorized or performed.**
