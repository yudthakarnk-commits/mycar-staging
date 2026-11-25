# MYCAR Step 162 — PWA version consistency & offline queue fail-closed guard
Date: 2026-11-25
Branch: `prep/production-rc-20261125` (in `yudthakarnk-commits/mycar-staging`)
**Status: Preparation only. NOT deployed. NOT Production-ready.**

## Changed in isolated preparation branch
- Selected provisional **3.5.0-rc.1** to align app Settings version text, PWA reload key, update URL, HTML CSS/JS query versions, and service worker shell URLs/cache ID.
- Service Worker cache remains under `mycar-staging-` prefix and existing scope restriction; no Production cache is touched.
- Kept existing per-project, per-user key `mycar_sync_pending_v1:${projectId}:${userId}` unchanged.
- Modified Queue loader to fail closed when JSON is unreadable, malformed, has invalid entry types, or mismatched queue key. This displays a blocking overlay and does **not** overwrite the original localStorage queue.
- Existing legacy entries with unknown original baseline remain pending and are flagged for conflict review. They are not silently auto-sent by the new revision-aware algorithm.

## Verification (source checks & mocked runtime)
- 10/10 static assertions PASS.
- Mocked startup checks: unreadable JSON blocks sync and preserves original bytes; valid legacy queue remains intact with unknown baseline; invalid typed queue blocks sync. PASS.
- JavaScript syntax validation of modified `cloud-sync.js`, `app.js`, `service-worker.js` PASS.

## OPEN blockers
- The HTML, auth config, restore UI, manifest and app logic still contain STAGING-specific features; this branch must not deploy as Production.
- Browser/PWA E2E and offline queue recovery on real Windows/iPhone/Android have not been exercised.
- User B's iPhone is not physically verified; assume no pending only for planning, not for authorization to revoke direct writes.
- Compatibility with active legacy direct-write clients and revision enforcement has not been proven; Production migration remains NO-GO.
- Some app shell behavior on service worker controllerchange needs real-device test. The new Queue guard is a protective halt, **not an automatic recovery**.
- No Production GitHub source, deployed site, Supabase database, or STAGING main branch was modified.

## Next
Step 163: remove remaining STAGING-only UI/config and build a clean candidate using non-secret, environment-injected Production public config; test at an isolated preview URL (never on the active Production PWA scope), then run realistic offline-queue migration E2E.
