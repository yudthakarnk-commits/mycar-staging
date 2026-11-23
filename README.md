# MYCAR STAGING — RPC Migration Validation

**Environment:** MYCAR-STAGING Supabase project `dlbshlvyhfwkorooxbnu` only. **Not Production.**

## What has been staged
- Full core browser application shell (HTML, JS, CSS) and a staging-only PWA icon/service worker.
- `auth-config.js` contains only the **public** publishable key for MYCAR-STAGING.
- `cloud-sync.js` now uses `mycar_apply_changes` with account revision and persistent request IDs.
- The legacy local JSON Restore action is **disabled** on this staging app until an RPC-backed Restore UI passes acceptance tests.
- Server-side private backups and five RPCs were installed on MYCAR-STAGING; production was not modified.

## Access
If GitHub Pages is enabled for this repository with **Deploy from a branch -> main -> /(root)**, test at:
https://yudthakarnk-commits.github.io/mycar-staging/

**Publishing and runtime verification have not yet been confirmed.** The staging website may return 404 until Pages is configured.

## Safety gate — not yet ready for cutover
- Legacy direct table INSERT/UPDATE access **remains enabled** on MYCAR-STAGING. Revocation would break legacy devices.
- Browser authentication, multi-device race, offline recovery, timeout and old-client-denial tests remain outstanding.
- Do not use this staging application with any production credentials or live production data.
- The app's Restore UI is intentionally inactive; do not claim it is implemented.
- **Do not apply these changes to `yudthakarnk-commits/mycar` or Production database.**

## Next tests
1. Confirm Pages is enabled and staging identity / config are correct.
2. Sign in with staging-only test account; verify read-only UI and existing records.
3. Test single-device edits, two-device revision conflicts, offline queued edits after a restore, and request retry after simulated loss of response.
4. Confirm legacy client writes are denied **after** switching the staging project to RPC-only write permissions.
5. Run the whole 18-case Acceptance Matrix, including an end-to-end reverse restore.

Any conflict needs an explicit user reconciliation decision, not last-write-wins fallback.
