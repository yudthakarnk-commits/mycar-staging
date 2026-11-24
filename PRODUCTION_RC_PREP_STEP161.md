# MYCAR Production Release Candidate — preparation branch
Date: 2026-11-25
Status: **WORK IN PROGRESS — DO NOT DEPLOY**.
Branch: `prep/production-rc-20261125` in `mycar-staging`.

## Completed on this branch
- Removed STAGING-only network-fault injections and their QA APIs from `cloud-sync.js`.
- Retained normal RPC write, idempotent saved-flight retry, conflict handling and restore-exclusive mode.
- Parsed modified JavaScript successfully; source inspected for STAGING QA tokens.
- Does **not** alter deployed STAGING main, Production GitHub repository, or Production Supabase.

## Blocking before any Production release
1. **Legacy offline queue.** Old and new clients share `mycar_sync_pending_v1:${projectId}:${user.id}`. Queue entries without an established base must not be silently sent. Preserve localStorage and inspect account, project and pending count.
2. **Mixed-version writes.** Until old devices are retired, direct `INSERT/UPDATE` remains enabled in Production; RPC account revisions may not reflect legacy updates. Do not enable RPC-only cutover yet. User B has not verified physical-device pending=0.
3. **Release cleanup.** `index.html`, `app.js`, `rpc-restore-staging.js`, `auth-config.js`, `service-worker.js` and manifest still contain STAGING-specific UI/configuration. No clean client deployment exists yet.
4. **PWA versions.** Current settings text says v3.3.1, while other assets use 3.4.2/staging build IDs. Agree one release version and update all cache identifiers together.
5. **Real test.** Parsing JavaScript is not end-to-end testing. Test staging with legacy queue simulations and real iPhone/Android/Windows PWA refresh, read/write, offline/retry, restore/reverse and account isolation.
6. **DB release.** Production still has no RPC schema; no migrations applied. Full Supabase Auth service recovery remains unproven. Capture fresh backup at cutover.

## Deployment constraints
- Never copy STAGING Supabase project URL or QA credentials into Production.
- No forced logout, reinstall, storage clear, or silent conversion of unidentified offline queue.
- Keep public.mycar_records direct write enabled until every legacy client and user is reconciled.
- Document rollback and receive separate explicit authorization before Production change.
