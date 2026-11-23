# MYCAR — Production Cutover Runbook (DESIGN ONLY)
Date: 2026-11-23
**Status:** DRAFT / NOT APPROVED FOR PRODUCTION CHANGES
**Read-only source review:** `yudthakarnk-commits/mycar` branch `develop` vs `yudthakarnk-commits/mycar-staging` branch `main`.
**No Production database or repository changes made.**

## 1. Confirmed source differences

| Topic | Existing `mycar/develop` | Tested STAGING |
|---|---|---|
| Writer | PostgREST direct UPSERT to `mycar_records` | `mycar_apply_changes` RPC |
| Retry | Legacy queue | Account revision, idempotent request ID, persisted flight |
| Conflict | Older behavior; do not assume equivalent | Record conflict + keep server/use local |
| Restore | Legacy backup paths | Preview, merge, private snapshot, reverse |
| Direct authenticated INSERT / UPDATE | Must inspect live Production grants before changes | Revoked in STAGING |
| Environment | Production data / credentials | STAGING project `dlbshlvyhfwkorooxbnu` only |

**Never copy STAGING URL, user data, publishable key, localStorage, or QA injector into Production.**

## 2. Preflight — READ ONLY, required before any production write

- Identify exact Production Supabase project and deployed website; verify explicit ownership and approval. Do **not** infer Production state from STAGING.
- Inventory every Production browser/PWA/device. Confirm all data synced, no pending queues, no unresolved flights/conflicts, and active user sessions are accounted for.
- Capture production DB schema, trigger/RLS policies, role grants, function definitions, and migration history; compare with the STAGING RPC schema.
- Create and independently verify a current full database backup, including user/account state, record tombstones, RPC operations, restore snapshots, RLS and Auth dependencies.
- Test full backup restore on an **isolated non-Production clone**, verify row counts and record hashes per user, plus login and RPC reads/writes. A migration-only branch without actual data does not satisfy this.
- Verify existing Production clients' local storage account/queue keys and installed Service Worker update behavior. Production and STAGING are different paths on the same GitHub Pages origin: preserve scope and cache isolation.
- Save exact source commit IDs, signed-off release artifacts, backup ID and rollback owner; establish a change freeze window.
- Remove STAGING-only diagnostic buttons, fault injection, app watermark, production URLs accidentally hardcoded, and fake test fixtures from a release candidate. Keep ordinary non-sensitive user diagnostics as appropriate.

## 3. Safe deployment order (NOT EXECUTED)

### Phase A — additive backend compatibility
1. Review all STAGING RPC definitions line-by-line against Production schema, owner permissions and RLS.
2. Install compatible private tables and authenticated RPC endpoints without revoking legacy direct write yet. All RPCs must derive `auth.uid()`, enforce per-owner isolation, input validation, request-id idempotency, revision fencing, and transaction locks.
3. Run SQL rollback-only tests (other-user denied, anon denied, stale revision, duplicate ID, restore/reverse, tombstone survival). Validate no persistent writes.
4. **STOP** if any existing Production data is changed or permissions break.

### Phase B — upgrade the Production client
5. Build a clean signed-off Production artifact pointing only to the confirmed Production Supabase URL and correct publishable key. **No QA/staging hooks.**
6. Deploy client with upgrade-required behavior for unsupported legacy versions; test on a non-primary device first.
7. Check real login, read, one controlled write, cross-device read, PWA refresh, background sync, offline queue and conflict; inspect Operations and Revision.
8. Confirm all devices upgraded and every old queue has been successfully migrated or manually exported.

### Phase C — close direct writes only after proof
9. Validate every device/account: `Synced`, Pending=0, no stored flight or conflict.
10. Explicitly confirm rollout and only then `REVOKE INSERT, UPDATE ON public.mycar_records FROM authenticated`.
11. Verify direct REST INSERT and UPDATE are denied, owner SELECT works, authenticated RPC writes work, anon RPC denied, and no duplicate operations.
12. Observe across two devices. Check database integrity and snapshot preservation.

## 4. Rollback decision tree

- **Before Phase C:** if the new client fails, roll back to the previous approved client *only when* queues can be safely recovered and backend still allows its documented writes; don't delete local storage.
- **After Phase C:** NEVER silently restore old direct write privileges as an automatic client fallback: it reopens revision-bypass writes. Use a controlled incident rollback with explicit administrator approval, root-cause review, and preserved backups.
- For a failed RPC migration, restore the verified database backup only in a managed recovery window with per-account reconciliation. A JSON app **merge-only Restore** is not a full database rollback.
- If uncertain whether a transaction committed, query the existing request ID's status. Do not send a new ID for the same potentially committed operation.
- Record who approved, when, what changed, verified snapshot hashes, and incident resolution.

## 5. Release acceptance blockers

| Gate | Verified on STAGING? | Production requirements |
|---|---|---|
| RPC write / account isolation / retries | Mostly PASS | Re-run against Production schema in rollback transactions |
| Conflict / offline barrier | PASS | Real multi-device smoke |
| App JSON restore/reverse | PASS | Backups verified and account ownership |
| Legacy direct-write deny | PASS | Last step only |
| Browser lost ACK (injection) | PASS — simulated | Release without injector |
| Actual physical mid-flight interruption | **OPEN** | Demonstrate or explicitly accept residual risk |
| Full database isolated DR | **OPEN** | Data-bearing clone & recovery proof |
| Security Advisor and password policy | Partly reviewed | Signoff and deployment-specific checks |
| Production inventory and external backup | **UNKNOWN** | Inventory and explicit approval |

## 6. Signoff

**NO-GO** until all high-impact gates are satisfied or residual risks have explicit documented acceptance. This runbook is preparation, not a request to edit Production.

Source: STAGING acceptance reports and live MYCAR GitHub develop read-only source comparison.
