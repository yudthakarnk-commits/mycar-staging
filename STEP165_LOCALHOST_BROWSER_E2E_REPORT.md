# MYCAR Step 165 — Localhost Chromium Browser E2E (No Deployment)
Date: 2026-11-25
Status: **CHROMIUM QA PASS 5/5 — PRODUCTION CUTOVER NO-GO**

## Isolation model
- QA branch: `qa/isolated-preview-step164`, derived from `prep/production-rc-20261125`.
- Test workflow: `.github/workflows/step165-localhost-e2e.yml`.
- Browser suite: `qa/step165.browser.test.mjs`.
- GitHub Actions run **45581032850**: https://github.com/yudthakarnk-commits/mycar-staging/actions/runs/45581032850
- Chromium loaded preview from `http://127.0.0.1:4173/` in the ephemeral GitHub Actions runner, a separate origin from `github.io`.
- All Supabase API calls were intercepted by in-browser Playwright routing and replaced with synthetic in-memory responses. All other external requests were blocked. No Production or STAGING user accounts and no real Supabase records were involved.
- Existing STAGING GitHub Pages workflow remains manual and restricted to `main`. This new workflow contains no Pages or remote deployment action. **No public preview URL was deployed.**

## Verified browser tests
1. **PASS** — Authentic page load with synthetic signed-in session; initial sync reports success; Service Worker controls the localhost origin.
2. **PASS** — Unreadable localStorage queue blocks Sync; original bytes stay unchanged; no RPC writes.
3. **PASS** — Old queue with unknown baseline shows a Conflict decision prompt; pending is retained; no RPC write before user decision.
4. **PASS** — Synthetic edit after a known baseline invokes one RPC; simulated lost acknowledgement is recovered through persisted request ID; one record, one write, no pending or flight left.
5. **PASS** — Queue stored under another account is not treated as the active account's queue.

Final GitHub Actions run 45581032850: 5 tests, 5 pass, 0 fail. Earlier runs failed due to a Service Worker navigation race in the assertion and an incomplete synthetic Fuel test record without `vehicleId`; both test fixtures/assertions were corrected and rerun. Fixes did not change Production.

## Additional QA-only repair
STAGING test repository lacked `icons/icon-192.png` and `icons/icon-512.png`, referenced by the clean RC. For localhost preview only, added `icons/preview-qa.svg` and updated QA branch HTML/manifest/Service Worker shell. This icon is unmistakably a QA icon; it is NOT the production logo and must not be promoted to Production.
The clean RC branch still requires valid actual icon assets or deliberately substituted verified assets at packaging time. Do not claim its PWA manifest is release-complete.

## Remaining blocked acceptance
- Real Supabase STAGING authenticated API, revision/RLS/RPC/restore flows not exercised in Step 165; browser API was mocked.
- Browser QA in this step ran on Chromium/Linux only. Windows, Android PWA and iOS/Safari physical testing outstanding.
- No public isolated preview deployment; a distinct *origin*, not merely a distinct Github Pages path on `github.io`, is required for public testing.
- Production direct Legacy writes vs RPC revision consistency unresolved; no cutover while old devices remain.
- User B iPhone queue not verified; do not force sign-out, reinstall, clear storage or revoke direct writes.
- Real mid-flight network interruption NET-02B and full Supabase service recovery remain unproven.
- Production backend unchanged, Production GitHub unchanged, deployed STAGING main site unchanged.

## Step 166 recommendation
Set up a dedicated isolated HTTPS preview hostname (distinct origin) and run authenticated STAGING test-account smoke including actual RPC writes, tombstone, conflicts, Restore preview/reverse, offline queue recovery and multi-device checks. Do not use a real user's backup.
**Release decision: NO-GO.**
