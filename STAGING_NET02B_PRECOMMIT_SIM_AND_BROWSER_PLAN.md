# NET-02B staging acceptance — 2026-11-23

## Scope
MYCAR-STAGING only. Production repository and database unchanged.

## Verified today
- Actual staging database inspected: revision 14, 14 operations, 15 records, test Fuel 29 L before this test sequence.
- Read staging cloud-sync.js from GitHub and ran a deterministic local JavaScript harness simulating a fetch connection drop **before apply RPC reaches server**.
- During drop: server revision 14, 0 writes, 1 pending record, persisted in-flight request, and a network connection error.
- After reconnect: server revision 15 (harness only), exactly 1 write, Fuel 30 L (harness only), pending 0, no stored flight, no error.
- Result: **PASS — simulated before-commit interruption**. Harness values are NOT values in Supabase.
- Prior browser result NET-01: simulated lost response **after server commit**, checked against actual staging DB; PASS.
- Prior browser result NET-02A: actual Offline queue followed by recovery; checked against actual staging DB; PASS.
- **NET-02B physical mid-flight network interruption: NOT YET EXECUTED; requires live browser evidence.**

## Next reproducible browser check (Network Request Blocking)
1. Open STAGING on desktop Chrome and verify Synced / Pending 0.
2. In DevTools, open More Tools > Network request blocking (Network panel three-dot menu).
3. Add pattern `*dlbshlvyhfwkorooxbnu.supabase.co/rest/v1/rpc/mycar_apply_changes*`, enable request blocking.
4. Edit ONLY the QA Fuel record (10,409 km), currently 29 L to 30 L, save.
5. Confirm the request is blocked; Pending should be 1, a stored flight remains. Capture Network and Diagnostics.
6. Disable request blocking, press Sync now, confirm Pending 0, Stored Flight false.
7. Verify Supabase operation count increased exactly once, revision +1, Fuel value 30 L. Record exact request ID from Network payload if accessible, without exposing JWT or Authorization.
8. This is **NET-02B1 blocked request then recovery**, not physical mid-flight interruption.

## Remaining hard gate
- NET-02B2: real network disruption while an in-flight apply is outstanding, with clear request timing and server before/after evidence. Cannot claim pass for this based on blocking before dispatch.
- Legacy direct-write privileges remain enabled pending safe cutover and legacy queue migration. Do not revoke yet.
