# MYCAR Step 166–168 — Browser Restore QA & Supabase Security Read-Only Audit
Date: 2026-11-25
Run: https://github.com/yudthakarnk-commits/mycar-staging/actions/runs/45589486814
QA branch: `qa/isolated-preview-step164`
**STATUS: 11/11 PASS in Chromium with mock API; production cutover remains NO-GO.**

## Completed browser QA
All 11 test cases PASS in a real Chromium browser on `http://127.0.0.1:4173` on ephemeral GitHub Actions runner:
1. Initial synthetic signed-in session, sync and registered Service Worker.
2. Corrupt local pending queue preserved and blocked.
3. Old queue missing baseline shows a conflict, no implicit upload.
4. RPC idempotency recovery after simulated lost HTTP acknowledgement.
5. Queue isolation between two user IDs.
6. User explicitly chooses Keep Server; pending clears with zero RPC writes.
7. User explicitly chooses Use Local; exactly one RPC write.
8. Deleting a record writes a tombstone, not physical deletion.
9. QA preview prevents replacing its STAGING auth endpoint with a different host.
10. Full UI workflow with synthetic backup: JSON validation, read-only Preview, explicit Merge Restore, immediate Reverse Restore; final synthetic cloud state equals pre-restore.
11. Pending legacy edits prevent Restore Preview, with no server write.

All data and auth responses were in-memory mocks. No live Supabase writes or external accounts were used. Earlier test failures were analyzed and corrected, including Service Worker navigation, synthetic-record validation, and a hidden modal element in a test fixture. Final run 45589486814 passed 11/11.

## Live read-only Supabase checks
STAGING project `dlbshlvyhfwkorooxbnu`:
- 15 records / 26 operations / 1 account state / 4 restore snapshots at time of check.
- Five `public.mycar_*` RPC functions present, all authenticated-executable and anonymous-not-executable.
- Each RPC is SECURITY DEFINER with fixed `search_path=pg_catalog`, uses `auth.uid()`, rejects null/anonymous caller identities, and scopes data by the caller UUID. This is **source inspection only**, not an authenticated attacker test.
- Direct `INSERT/UPDATE` to `public.mycar_records` revoked for `authenticated`; SELECT allowed through ownership RLS.
- Security Advisor WARN: five intentional callable SECURITY DEFINER endpoints requiring scrutiny; leaked-password protection disabled.
  https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

PRODUCTION project `pteskuyswmwppswzegxp` read-only baseline:
- 254 total records, 253 nondeleted, 1 tombstone, 3 accounts.
- No Production data, permissions, schema, GitHub code or deployed site changed.

## Critical blockers and manual acceptance
- Real authenticated STAGING RPC E2E (with dedicated synthetic test user and browser) **not performed**.
- iPhone/User B offline queue **not verified**; do not force sign-out, reinstall, storage clear or revoke old-client writes.
- iPhone, Android, Windows PWA physical-device QA unperformed.
- No independent public HTTPS preview origin or approved preview deployment.
- Mixed Legacy direct writes versus RPC revision handling **NOT RESOLVED** until all old devices are retired, or a separately verified compatibility design exists.
- Clean RC references original production PNG icons not yet transferred into staging repository; final packaging incomplete.
- Production database RPC upgrade not installed and not authorized.
- Full Supabase Auth recovery not verified; fresh cutover backups and rollback acceptance missing.

**Do not merge QA STAGING keys, fake-auth fixtures or QA-only icons into a production bundle.**
**Release gate: NO-GO.**
