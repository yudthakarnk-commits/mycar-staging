# Cutover review checklist — NOT AUTHORIZED
Evidence: five RPC definitions matched live staging after whitespace/terminator normalization. Production updated_at trigger exists; staging does not. Retain trigger pending compatibility review. Rollback draft defaults to ROLLBACK, not executed.
Before approval:
- Build production-only allowlisted artifact from pinned RC2, with original production illustrations/icons, correct HTTPS scope, production public key only, no QA assets. Validate syntax, binary signatures, SW shell and cache isolation.
- Confirm recoverable full database/Auth backup and secure storage, original user IDs, Auth settings, backup timestamp. No credentials in git.
- Review actual database ACLs, private schema, trigger, RPC definitions and migration target guards. Review exact rollback artifact.
Cutover after separate explicit approval only:
- Quiesce all legacy clients, pending queues zero, capture fresh backup and UTC fingerprint. No concurrent legacy/RPC writers.
- Apply approved migration transaction, verify data preserved and grants/RLS, then deploy verified artifact. Check real production upgrade and account isolation before resuming use.
- Abort on any mismatch. If post-commit rollback needed, freeze writers, preserve new data and audit history, restore compatible legacy permissions and pinned legacy app, verify before resuming. Reconcile revisions/queues before any later RPC reenable.
