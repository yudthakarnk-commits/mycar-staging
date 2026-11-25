# MYCAR Step 169–175 continuation — 2026-11-25
Production cutover: NO-GO. No production writes or deployment.

## New verified work
- STAGING live RPC source review found legacy anonymous claim setting does not detect JSON JWT anonymous=true. Reproduced with authenticated SQL role and synthetic claims, no cross-account disclosure demonstrated.
- Applied STAGING migration mycar_rpc_require_permanent_jwt_identity to all five RPCs; require JSON boolean false via auth.jwt(). 10/10 rejection assertions passed (anonymous true and null claim, five RPCs each).
- SQL transaction with two temporary users and simulated JWT claims passed initial revision, apply, retry, stale revision, owner visibility, preview, merge, cross-account isolation including snapshot rejection, reverse, exact row snapshot, tombstone. Rolled back. Not actual Auth login or HTTP/browser E2E.
- Post rollback: records 15, operations 26, account states 1, snapshots 4, synthetic users 0.
- Security advisor: five intentional SECURITY DEFINER warnings and leaked password protection disabled remain.
- RC icons copied from production develop with identical Git blob hashes, commit 2c45d3c6f17a619753cd1d836e3139caf1d2346d. Manifest references resolved, 19/19 non-root service worker shell files exist.
- Verified patched function source preserved in qa/backend/mycar_rpc_require_permanent_jwt_identity.sql, commit c7d4ede0819675b7f96f2a9e369b9c7be6363668. Not initial schema migration.
- Eight active RC files scanned for literal staging/production project IDs, selected QA markers and sb_secret pattern; none found. Not full package secret audit.
- Production read-only: 254 records, 1 tombstone, 3 data-owning accounts, legacy INSERT/UPDATE enabled, 0/5 new RPCs. No changes.

## Remaining release gates
1. Actual dedicated permanent-user STAGING login and HTTP RPC/browser E2E on independent origin. SQL role simulation and earlier mocked browser tests do not substitute.
2. Physical Windows/iPhone/Android acceptance, User B pending=0 confirmation, preserve local storage. No forced signout.
3. Resolve mixed legacy/RPC writes by verified device retirement or tested compatibility design; never revoke production write privileges prematurely.
4. Fresh complete production backup (including Auth), isolated data-bearing restore rehearsal and reconciliation; app merge/reverse alone is insufficient. No billable clone created.
5. Complete deployment allowlist, production-specific config/version/cache review and full package audit. RC remains unconfigured and not deployed.
6. Review leaked password protection availability and accept residual SECURITY DEFINER warnings. Separate explicit cutover approval after gates.
7. Physical mid-flight interruption remains open unless explicitly accepted as residual risk.

## Disposition
Step 170 database layer PASS; real Auth/browser OPEN. Step 171 asset/static partial PASS; steps 172–174 OPEN; step 175 NO-GO; step 176 not executed.
