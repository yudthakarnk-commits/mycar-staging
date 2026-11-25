# Step 175 — Final release acceptance (2026-11-25)
**NO-GO; no production deployment or database mutation.**
## Evidence
- Owner screenshots: isolated local PostgreSQL 17 restore committed 254 records, 1 tombstone, 3 accounts, fingerprint a2f187cae13eb9b2a53acc2362b8d6d2. Restart count checks identical; actual Supabase Auth recovery not covered.
- Production read-only current fingerprint matches backup; 254 rows, 1 tombstone, 3 data accounts, no new RPCs, legacy INSERT/UPDATE and TRUNCATE granted, anon SELECT denied.
- STAGING: 15 records, 4 tombstones, 2 data owners, five RPCs, direct INSERT/UPDATE/TRUNCATE denied.
- RC exact environment origin fail-closed (4b634ed, 3e48238); seven unit cases pass with URL parser stub, not browser E2E.
- RC service worker cache namespace by registration scope (f015d70); mock namespace separation pass; real upgrade untested.
- Prepared rollback-only TRUNCATE permission script (d22aee9), not executed on production.
- Production advisor: leaked password protection disabled.
## Mandatory cutover correction
The older draft permits a period of mixed legacy direct writes and RPC writes. Do not permit this: legacy writes do not increment account revision. Choose a maintenance window with every client quiesced, confirmed Pending=0 immediately before freeze, no new legacy writes, then install tested backend and revoke direct writes before admitting new RPC clients. Test the exact migration and rollback on isolated PostgreSQL/Supabase first. Do not use an old client after revocation; preserve queues and backups. No production changes authorized here.
## Remaining gates
- Real permanent-user STAGING browser login and HTTP RPC tests on independent origin, with synthetic users only.
- Actual PWA update and offline recovery on intended devices; owner confirmed pending zero on existing devices, not new RC.
- Full Auth backup/recovery or explicit accepted recovery plan, password protection plan, complete deployment allowlist and clean artifact test.
- Approved maintenance window and tested production-target migration including private schema, grants, triggers and rollback; fresh backup/fingerprint immediately before cutover.
- Physical mid-flight network loss still unverified unless explicitly accepted.
No production cutover until these gates or separately documented risk acceptance are resolved.
