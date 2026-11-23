# MYCAR-STAGING — Real network interruption and legacy write cutover

Date: 2026-11-23. **STAGING ONLY. Do not change Production.**

## Current confirmed state
- Browser Build: 2026-11-23.7 (as of last deployed evidence).
- STAGING account revision: 12 after NET-01 lost HTTP acknowledgement simulation.
- STAGING `authenticated` can currently directly SELECT, INSERT, UPDATE `public.mycar_records`.
- Upstream `mycar` / `develop` `cloud-sync.js` still uses POST with `Prefer: resolution=merge-duplicates`; no account RPC.
- STAGING `cloud-sync.js` uses `mycar_apply_changes` and `mycar_get_sync_state`.
- Therefore old clients **must be migrated or explicitly handled before privilege revocation**.

## NET-02: physical browser/network interruption (not yet executed)
**Prerequisites:** Use STAGING, one browser only; ensure Synced / Pending 0; Export All Records JSON. Do not clear browser storage. Use the known QA Fuel record 10,409 km (currently 26 L, but verify first).

1. On a desktop, open STAGING, make sure last Sync has completed; keep Settings accessible. Take a screenshot of Synced/Pending 0 and record current Revision.
2. Open DevTools (F12) > Network, enable **Preserve log**, filter `mycar_apply_changes`; avoid checking `Disable cache` or clearing storage.
3. Change only the designated Fuel record from 26 L to 28 L and Save.
4. **While the POST request is pending**, temporarily interrupt network using Windows Wi-Fi OFF or Chrome Network > Offline, and capture whether the request completed/failed. If the request finished before interruption, NET-02 is **not** proven; repeat only after inspecting the new server revision and revising test values.
5. Restore network. Wait for automatic Sync or press Sync now. Do not refresh tab or clear local storage while pending.
6. Open Sync Diagnostics and capture: `serverRevision`, `pendingCount`, `storedFlight`, `lastRpcCheck`, `lastRpcWrite`, `lastError`.
7. Check STAGING server for exactly one operation using the request ID if DevTools captured it; if request was never committed, check for one successful retry using its persisted flight ID. Verify the Fuel payload and Revision.
8. Passing result: one final committed change, Pending 0, Stored Flight false, no duplicate operation; any failed or inconclusive timing is **not a PASS**.

**Safety:** If a Conflict appears, do not resolve it until server Revision and record values have been reviewed. Never press Clear All Data. A physically interrupted request may or may not reach the server.

## Legacy direct-write cutover prerequisites
- Inventory STAGING browser clients and any queued pending edits; finish Sync on supported clients.
- Retain read-only authenticated SELECT on `public.mycar_records` for new client's downloads.
- Deploy a legacy **upgrade-required** UX on legacy staging origins or ensure old clients are retired. Otherwise old clients may endlessly retry.
- Confirm that all authorized clients use RPC and successfully Sync after temporary revoke rehearsal.
- Audit ancillary table policies, triggers and RLS; avoid blanket grants or anonymous execution.
- Record time, snapshot and rollback readiness.
- Only after signoff, perform permanent STAGING-only migration:
  `REVOKE INSERT, UPDATE ON TABLE public.mycar_records FROM authenticated;`
  Do NOT revoke SELECT; DO NOT touch Production.
- Rollback only if authorized and tested:
  `GRANT INSERT, UPDATE ON TABLE public.mycar_records TO authenticated;`
  Restoring legacy privileges reopens the bypass and should be temporary. Do not promote to Production before signoff.

## Status
- NET-01 simulated lost-ack browser test: PASS; one committed write checked in STAGING.
- NET-02 physical interruption: **NOT TESTED**.
- Legacy denied-write when revoke executed inside SQL transaction and rolled back: PASS previously.
- Permanent STAGING revoke: **NOT DONE**, for data-safety.
