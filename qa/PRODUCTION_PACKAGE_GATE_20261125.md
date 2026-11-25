# Production release gates — MYCAR RC.2 — 2026-11-25
NO-GO. Preparation only. Do not deploy or modify production.
Source commit: e47312fd75c6f14bac3c979022646ceb9aa44523.
## Verified evidence
Production read-only audit: 254 records, 1 tombstone, 3 owners, fingerprint a2f187cae13eb9b2a53acc2362b8d6d2.
Fingerprint SQL: SELECT md5(string_agg(md5(to_jsonb(r)::text),'' ORDER BY user_id,collection,record_id)) FROM public.mycar_records r; Use consistent UTC session timezone.
Staging: RLS enabled, anon reads denied, authenticated direct INSERT/UPDATE/TRUNCATE denied; five RPCs have owner/anonymous guards and fixed search_path. SECURITY DEFINER warnings remain; private tables lack RLS but are inaccessible to anon/authenticated. Leaked password protection disabled in both environments.
Real Windows browser: authentication, refresh, create/edit/delete, offline queue persistence, account isolation, restore preview/merge/reverse and RC1-to-RC2 upgrade passed in prior tests. Offline dashboard reload requires online auth. Physical mobile and real mid-flight interruption not verified.
## Deployment allowlist
index.html, auth-config.js, auth.js, cloud-sync.js, app.js, sync-health.js, restore-dry-run.js, backup-preview.js, rpc-restore.js, tng-import.js, vehicle-photos.js, service-worker.js, manifest.webmanifest.
assets/: auth.css, app.css, car-photos.css, tng-import.css, mobile-viewport-fix.css, sync-health.css, backup-preview.css.
icons/: icon-192.png, icon-512.png, apple-touch-icon.png (replace staging.svg HTML reference using original production icon).
Text assets verified; binary icons require separate file signature, dimensions and hash check. No QA/SQL/backups/docs/git metadata in deployed web root.
Production endpoint verified from develop: https://pteskuyswmwppswzegxp.supabase.co. Exact live HTTPS origin and scope still require verification; use public publishable key only, not service_role or secret. Do not configure candidate with production credentials yet.
Legacy cache name: mycar-shell-cloud-v15-scroll-expenses-3-4-2. Test targeted legacy-cache transition with stale tabs and pending queue. Never clear all origin storage/caches.
## Migration and rollback
qa/backend/STEP175_9_LOCAL_MIGRATION_REHEARSAL.sql is LOCAL ONLY: simulated auth, synthetic users, rollback. Not deployable. Prepare real Supabase migration separately with exact staging definitions and reviewed grants.
Post-commit rehearsal required on a disposable clone: capture baseline rows and ACL/policy/schema definitions; commit migration; verify security; create synthetic post-commit writes; freeze writes; test compatible rollback preserving post-cutover records; compare full row hashes before/after rollback and verify old client compatibility. Do not overwrite new data with pre-cutover backup. Retain audit/restore history in protected storage. Never test rollback on production.
Cutover: approved maintenance window; quiesce all old clients; confirm pending=0; fresh backup and fingerprint; install RPC backend and revoke legacy writes in one transaction; verify backend; only then admit new clients. No mixed legacy/RPC writers. Abort on failed checks.
## Remaining approvals
Physical iPhone and Android upgrade on isolated HTTPS staging; actual Supabase Auth recovery or accepted recovery plan; post-commit rollback; binary asset and clean artifact tests; exact production origin/configuration; security warnings reviewed and risks accepted; final cutover authorization.
