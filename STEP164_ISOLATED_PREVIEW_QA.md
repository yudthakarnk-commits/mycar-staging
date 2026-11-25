# MYCAR Step 164 — Isolated Preview Preparation & Mocked Sync QA
Date: 2026-11-25
Status: **PREVIEW BRANCH CREATED / NOT DEPLOYED / PRODUCTION NO-GO**

## GitHub branches
- Clean candidate source: `prep/production-rc-20261125` (no embedded Supabase endpoint)
- QA-only preview: `qa/isolated-preview-step164` (derived from clean candidate)
- QA preview locks `auth.js` to `https://dlbshlvyhfwkorooxbnu.supabase.co`; only a public publishable key is in `auth-config.js`.
- Do NOT merge QA-specific allowlist/config into Production candidate. The preview-only branch is intentionally tied to STAGING test accounts.

## Executed non-deployment mock tests
7/7 PASS against actual `cloud-sync.js` loaded from the preparation branch and a controlled simulated fetch/localStorage/DOM runtime:
1. Invalid JSON pending queue blocks startup without overwriting stored bytes.
2. Valid legacy pending queue is preserved and marked unknown baseline.
3. Legacy unknown-baseline edit stays pending; there is no unconfirmed RPC upload.
4. Offline state retains edits and does not send a write.
5. New edit without established baseline is not silently uploaded after reconnect.
6. With a known baseline, RPC apply writes once and clears a safely acknowledged queue.
7. After a simulated response loss **after server commit**, readback by preserved request ID recovers acknowledgement without duplicate write.

**Limitations:** The first mock attempt was invalid due to a missing `URLSearchParams` test shim; it was corrected and rerun. This was a simulated HTTP fault, not a physical in-flight network interruption.

## Preview-source checks
12/12 PASS on QA preview branch:
- STAGING-only endpoint allowlist, STAGING-only embedded public config, no secret keys;
- STAGING-scoped service-worker cache deletion; project/account-specific queue keys and fail-closed protection;
- no fault-injection buttons or hooks;
- release-version consistency; syntax parse of four principal scripts.

## NOT YET VERIFIED
- No deployed Preview URL; no browser, iPhone, Android, Windows PWA or actual Supabase RPC end-to-end runs.
- No production accounts or vehicle records used in tests.
- Browser service-worker update/CacheStorage functionality, offline reinstallation scenarios, and secure origin behavior remain unverified.
- Mixed direct-write Legacy vs revision-aware RPC remains a blocker.
- User B's offline queue has not been physically checked.
- Production RPC schema has not been installed and Production direct-write permissions are unchanged.
- Authenticated Restore preview/merge/reverse still needs controlled STAGING test-account acceptance.
- Old cached clients cannot be guaranteed to update immediately just by publishing a new PWA shell.
- Care is required: browser storage is shared by origin, not by path. Do not run QA preview on a path/scope sharing Storage with any active Production client; use a distinct origin and dedicated test browser profile.

## Next release gate
1. Provision a **separate preview origin** and publish only the QA branch there, without changing existing STAGING or Production Pages config.
2. Confirm preview URL, Service Worker scope, and actual runtime bound to STAGING test account.
3. Run real browser/device E2E on synthetic records, including pending queue, tombstones, offline retry, reconnection, stale-revision, lost acknowledgement and Restore.
4. Inspect actual results and recoverability before proposing Production change.

**No Production cutover authorization has been requested or granted; NO-GO.**
