# Step 175.11.16 — Post-commit rollback rehearsal
Date: 2026-11-25. PASS within synthetic local PostgreSQL 17 SQL test scope.
Owner executed in isolated Podman container mycar-rollback-qa, network none, database mycar_rollback_qa. No production or staging DB mutation.
Evidence: screenshots and owner confirmations.
- Synthetic baseline 3 rows, 1 tombstone, 2 owners.
- Migration extracted from qa/backend/STEP175_9_LOCAL_MIGRATION_REHEARSAL.sql; committed successfully per owner.
- Post-migration: 3/1/2 unchanged, authenticated SELECT true; INSERT/UPDATE/TRUNCATE false; 5 RPCs.
- RPC create/edit/delete/restore committed, pre-rollback baseline 5 rows, 2 tombstones, 2 owners, 3 operations, 1 restore snapshot, 1 account state row.
- Rollback committed: authenticated SELECT/INSERT/UPDATE true, TRUNCATE false, executable RPC count 0. RPC history retained.
- Full row fingerprint before and after: 67181a56a2c6e9b808d426674b141853. Bidirectional EXCEPT checks records/operations/snapshots/account_state all true.
- Legacy SQL insert and update succeeded; cross-account read/insert blocked; RPC execution denied; final commit 6 rows, 2 tombstones, 2 owners.
Limitations: synthetic users and RLS; no actual Supabase Auth, real legacy PWA, simultaneous requests or production-target migration/rollback execution tested. Rollback is compatibility-mode switch, not full schema removal. Future RPC re-enable requires reconciliation of revisions and client queues after legacy writes. No mixed legacy/RPC writers.
Remaining NO-GO gates: physical iPhone/Android PWA acceptance, actual Auth recovery or approved recovery plan, production deployment package/config and clean artifact checks, production-target migration/rollback review, security warning review, final authorization. Preserve QA container evidence.
