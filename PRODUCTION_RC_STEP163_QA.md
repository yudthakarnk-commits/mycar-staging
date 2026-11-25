# MYCAR — Step 163 Clean Release Candidate QA
Date: 2026-11-25
Branch: `prep/production-rc-20261125` in repository `mycar-staging`
Status: **SOURCE PREP PASS; RELEASE GATE NO-GO. DO NOT DEPLOY.**

## Actual changes on isolated preparation branch
- Removed two STAGING network-fault test panels and build diagnostic panel from `index.html`; removed STAGING warning banner.
- Replaced staged labels/title and switched PWA manifest icons to standard MYCAR assets.
- Replaced `auth-config.js` with an intentionally unconfigured public-only template; no project URL or key is embedded. Environment-specific values must be injected/verified by a separate release process.
- Created generic `rpc-restore.js` and removed the unused, hardcoded `rpc-restore-staging.js`. The new module obtains the authenticated project's URL from `AuthManager.config` and retains user confirmation, pending-queue checks and transaction RPC use.
- Removed unreachable dangerous direct JSON local data replacement code from `app.js`; only the safe denial message remains for its former entrypoint.
- Kept Step 162 fail-closed offline queue protection unchanged, as well as provisional 3.5.0-rc.1 version pins and staging-scoped SW cache prefix.
- No changes to GitHub Production repository `mycar`, Production Supabase, or deployed `mycar-staging` main branch.

## Verification: 18/18 source/static checks PASS
No test controls in HTML; no hardcoded STAGING project URL in inspected active files; no embedded API key; generic Restore endpoint; Restore script linked in HTML & SW; no direct replacement code; valid manifest with 2 icons; queue corruption fail-closed; SW scope/cache isolation; version pin consistency; syntax parses on 8 inspected JS files.

## Critical limitations / release blockers
- **Not browser E2E:** Source parse and static checks cannot prove functional PWA upgrades, offline reconnect, restore/reverse flows, or data integrity.
- **Not deployed:** Branch preview is not an isolated running website; a separate preview origin/scope still needs to be prepared and tested with test accounts.
- **Unconfigured Auth:** `auth-config.js` is blank by design, but existing `auth.js` supports locally persisted project settings. Preview setup must explicitly verify endpoint and account so it never points to Production unexpectedly.
- **Compatibility not solved:** RPC revision remains incompatible with untracked direct legacy writes. Keep Production direct-write permissions unchanged; maintain NO-GO.
- **User B unverified:** Physical iPhone pending queue status remains unknown. Never force sign-out, PWA reinstall, storage clearing or revoke legacy direct write.
- **Restore release gate:** Even generic Restore must remain disabled for deployment until full backend RPC security checks and end-to-end recovery tests pass. This preparation branch is not approval to execute real-account Restore.
- Existing SW cache ID intentionally stays prefixed `mycar-staging-` because this is a preview preparation branch. Before deploying any Production build, use the correct distinct cache prefix, correct URL scope and a staged release plan.
- This branch still contains unreviewed files from the STAGING app, and must pass a complete source/package leak review before promotion.

## Next step — Step 164
Create a standalone isolated preview package and test it against STAGING-only test accounts, including: corrupt/pending legacy queue, wrong-user/wrong-project queue separation, offline-to-online retry, PWA cache update, no queue deletion, account isolation, and Restore preview/reverse on dedicated test data. Capture results before any proposal to edit Production.

**Production Cutover = NO-GO.**
