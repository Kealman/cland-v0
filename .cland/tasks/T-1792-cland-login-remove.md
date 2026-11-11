---
id: T-1792
kind: task
title: "`cland login remove`"
state: open
status: in progress
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1779
  - T-1781
  - T-1783
topic: topic-1475
branch: t/T-1792-cland-login-remove
created: 2026-11-09T12:44:12.424Z
updated: 2026-11-11T09:31:42.615Z
---

## Summary

`cland login remove <name>` deletes a disk login's volume and every snapshot, each confirmed by a read, then its row. For a key login it deletes `.cland/auth/<name>.key` and the row. The command is refused while the login is in use, naming the host.

## What to build

The `login.remove` frame and `cland login remove`. A deletion the provider does not confirm keeps the row with the ids that remain, and the command exits nonzero naming them, so a rerun finishes the work. Removing a `creating` login is refused while its sign-in runs. The `[auth]` store key is never removed.

## Acceptance criteria

- [ ] C1. `cland login remove` of an in-use login is refused naming its host and changes nothing (test).
- [ ] C2. After that host stops, the same command deletes the volume and both snapshots with confirming reads, and the login leaves `cland login list` (test).
  - failed: rev-37 [reviewer] · 2026-11-11T09:31:42.615Z · note Declared shared markSignedOut integration remains unavailable for normal ready disk removal.
- [ ] C3. A deletion the provider does not confirm keeps the row with the remaining ids, and the command exits nonzero naming them (test).
  - failed: rev-37 [reviewer] · 2026-11-11T09:24:07.460Z · note After a lost snapshot response, retry/restart removes the row instead of retaining the unconfirmed resource's ownership.
- [ ] C4. Removing a key login deletes its key file and its row, and leaves the `[auth]` key (test).
  - failed: rev-37 [reviewer] · 2026-11-11T09:31:42.615Z · note Declared shared markSignedOut integration remains unavailable for normal ready key removal.
- [ ] C5. Removing a `creating` login is refused naming the running sign-in (test).

- [ ] C6. When a deletion is not confirmed and the row stays, the confirmed deletions are recorded through LoginRecords.deleteStorage and only the unconfirmed items keep accruing in host status; a fully removed login's storage leaves host status with its row, as docs/hub/logins.md then states (test).
  - failed: rev-37 [reviewer] · 2026-11-11T09:31:42.615Z · note Known snapshot receipt recovery skips storage lifetime after a one-shot recordStorage failure, reproducing undercount in both same-owner and reopened-store paths.
## Blocked by

- T-1779
- T-1781
- T-1783

## Notes

- Hot files: `hub/src/host/login-remove.ts` (new), `hub/src/host/logins.ts` (row removal), `hub/src/cli/login.ts` (`remove`). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`.
- Tests: new `hub/test/login-remove.test.ts` (T2, the fake provider's `ignoreVolumeDelete` for C3).
- Serves epic C9.

## Comments

### impl-1792 · 2026-11-11T09:07:31.507Z

Rule 20 pre-change sweep: shared suite transitive graph across all tier manifest entries reached 700 tests (15 unknowns conservatively reached); full lists published as item artifacts. Explicit field/frame/function sweep spans production, web/nvim/shared clients, skills, QA briefs, docs and every test tier. Existing public Login/list wire fields stay compatible; new login.remove frame is additive. Private removing column fences LoginRecords.transition (sign-in), bind/addBinding and beginReader (binder); ready rows use T-1793 markSignedOut to leave unchanged capacity index. Native consumers reached include host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back and login-exclusive-native; their ordinary behavior is unchanged absent a removal claim. Protocol catalog/Neovim fixtures need additive registration evidence. Single contiguous remove command/dispatch blocks and additive protocol/help/web-authority registrations are planned per Coordinator approval.

### impl-1792 · 2026-11-11T09:17:39.066Z

Initial source head d92c96584cabfca9a68ff46cd4f5189c21e8c71a pushed to origin; fetched/merged origin/dev (already current). Per Coordinator c0a112c9, source review overlaps shared T-1793 dependency; final criteria marks and verification wait for real-method integration. Registrations: additive login.remove in protocol.ts (union/parser), dispatch.ts case/contiguous handler, cli/login.ts command, cli/help.ts help route, cli/usage/login.ts text, shared/wire/index.ts union, web-authority.ts refusal; other lanes' logic unchanged. `npm run test:nvim-fixtures` exit 0 with 6056 recorded frames and catalog consumers; restored its three unrelated explorer catalog deletions (T-1804 nondeterminism). A-18633: 42 targeted T2 tests green on macOS Node24.21.0, remove CLI dependency case excluded; A-18634 full TMPDIR names unchanged 9873→9873, appeared/disappeared empty. Secret scanner passed with positive control. Hub typecheck, child-environment and closed-item lints pass; test lint report mode has zero refusals. Full Linux verify, native slot, T3 merge batch and T4 occasions not run.

### rev-37 · 2026-11-11T09:24:07.460Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1792-source-1
commit: d92c96584cabfca9a68ff46cd4f5189c21e8c71a
scope: full
findings: [{"severity":"high","text":"Unknown snapshot outcome is fenced only by the current active promise. Retry/reopened store ignores retained pending/outcome and removes known storage plus row while accepted snapshot remains orphaned. Exact-head A-18635 reproduces both paths: retry removed,row null,orphan found. Persist the admitted unknown fence until positive reconciliation.","file":"hub/src/host/login-snapshots.ts","line":186},{"severity":"medium","text":"Declared T-1793 integration blocker: markSignedOut is absent and ready-row removal throws 'login signed-out transition unavailable'. Real ready disk and key removal remain incomplete. Integrate the authorized shared method and direct call, then re-review the exact head; injected signed-out fixtures are not full CLI coverage.","file":"hub/src/hub/dispatch.ts","line":2223},{"severity":"medium","text":"FIFO onCleanup closes Store before snapshot owner and later held-gate/work joins. Assertion failure/cancellation can write after DB close or deadlock on snapshot.close before gate release. Release gates and join all admitted work before owners/storage/directories; keep assertions and bounded cleanup proof.","file":"hub/test/login-remove.test.ts","line":40},{"severity":"medium","text":"LOGIN_USAGE golden still has pre-remove bytes while production prepends login remove, so exact-export compatibility assertion cannot pass. Migrate only the intended row, retaining guard assertions.","file":"hub/test/fixtures/cli-usage/commands.json","line":77},{"severity":"low","text":"Explicit local-human login-frame list omits login.remove. Update this matching permission documentation under rule16.","file":"docs/agents/session-permissions.md","line":153}]
finding_counts: {"high":1,"medium":3,"low":1}

Initial full source review at d92c96584cabfca9a68ff46cd4f5189c21e8c71a is not clear. All five findings, Standards/Spec assessment and evidence limits are in A-18638 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18638-t-1792-initial-source-review-at-d92c96584-not-clear.md). Exact actual failure quoted before diagnosis: A-18635 reports 'unknown snapshot must retain its row and durable ownership after retry'; both same-owner/reopened-store retries observed {retry:'removed',row:null,orphan:'found'}. These are Implementer-executed isolated macOS Node24.21.0 controls, not Reviewer tests. Declared ready-CLI dependency is actual 'cland: login signed-out transition unavailable'. The T-1793 seam is an acknowledged integration blocker per Coordinator, not final-ready behavior. Reviewer ran no tests/typecheck/native/browser. A-18633's42 targeted passes exclude that red CLI case; configured Linux remains unrun. Source reviewed durable claim/admission, provider absence receipts, accounting, encrypted-key/auth preservation, snapshot and dispatcher lifecycle, protocol/authority/shared wire, tests and docs. C2/C3/C4/C6 failed/incomplete; no criteria verified; C1/C5 remain unverified. A-18625 is700 reached plus15 additional unknown paths (715 conservative union), plus explicit A-18626 consumers; retain all in subsequent normalization. Await Coordinator's authorized dependency merge, fix batch, then fresh exact-head source review before native/configured verification. FullT3/T4/affected after-stage QA remain separate.

Criteria: C2 failed (Ready-row CLI removal has the declared missing markSignedOut dependency; unknown-snapshot retry can remove the row with an orphan snapshot.), C3 failed (After a lost snapshot response, retry/restart removes the row instead of retaining the unconfirmed resource's ownership.), C4 failed (Normal ready key removal also hits unavailable markSignedOut; current key test seeds signed-out and does not establish that path.), C6 failed (Unknown snapshot retry deletes the entire row and its accounting while the provider snapshot remains.).

### impl-1792 · 2026-11-11T09:28:04.387Z

Review-fix rule20 correction: A-18625 conservative union is 715 (700 reached + 15 separately unknown), plus explicit A-18626 consumers. Snapshot callers reviewed explicitly: snapshotLoginDisk in login-signin.ts (terminal sign-in), LoginSnapshots.launch in login-snapshots.ts (manual/daily/restart), Dispatcher login.snapshot (CLI/socket), installLoginRelease beginRelease/onReleased hooks, login-remove.ts beginRemoval, reader/release owners and their fixtures. Production snapshot providers fake.ts and digitalocean.ts share positive snapshotted/not-sent/refused vs failed outcome semantics; failed remains unknown. New private snapshot_admission is written/settled only by snapshot owner, read by removal and final row-removal guard. A-18635/A-18636 demonstrate red before fix; both permanent retry/reopen cases also failed `Missing expected rejection` before fix. Existing wire/Login shape is unchanged, and no consumer infers admission settlement from list omission. Golden migration is limited to LOGIN_USAGE bytes; permission-doc enumeration updated.

### rev-37 · 2026-11-11T09:31:42.615Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1792-source-2
commit: a72800b258400371c008b9a79c3caec3e2171e0d
scope: full
findings: [{"severity":"medium","text":"settleSnapshotAdmission captures backup.receipt and clears admission before recordStorage (line68). Failure/crash in that gap leaves recovery (lines46–47) skipping the storage lifetime permanently; snapshotIds is restored but host status undercounts. A-18641 reproduces same-owner/reopened-store failure. Atomically retain positive receipt, matching lifetime and settlement; repair accounting on receipt recovery.","file":"hub/src/host/login-snapshots.ts","line":64},{"severity":"medium","text":"Known T-1793 dependency remains: absent markSignedOut throws 'login signed-out transition unavailable' for ready disk/key removal. Integrate only after Coordinator instruction, replace seam with direct shared method and review the exact integrated head before verification.","file":"hub/src/hub/dispatch.ts","line":2223}]
finding_counts: {"high":0,"medium":2,"low":0}

Full corrective source pass at a72800b258400371c008b9a79c3caec3e2171e0d is not clear; A-18643 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18643-t-1792-source-review-at-a72800b25-receipt-accounting-and-integration-pending.md) contains findings/evidence limits. Actual failure: 'recovered known snapshot must have an accruing storage lifetime' in A-18641/A-18642. Implementer-executed exact-head macOS Node24.21.0 same-owner and reopened-store controls show snapshot receipt recovery returns snapshotted and restores ID, but storage.items contains only volume. This is the new accounting split after durable receipt/admission settlement. Prior orphan fence, LIFO held cleanup/forced failure, golden-only migration and permission docs are resolved by source; source-1's declared T-1793 method blocker remains. No other findings; no criteria verified. A-18640's48 local T1/T2 passes exclude the ready CLI dependency. Reviewer ran no tests/typecheck/native/browser. No configured Linux/native/fullT3/T4/QA pass claimed. Fresh corrected-head source review remains required before verification, following only the authorized dependency merge. C2/C4 integration incomplete; C6 failed. Conservative715 graph plus explicit consumers retained.

Criteria: C6 failed (Known snapshot receipt recovery skips storage lifetime after a one-shot recordStorage failure, reproducing undercount in both same-owner and reopened-store paths.), C2 failed (Declared shared markSignedOut integration remains unavailable for normal ready disk removal.), C4 failed (Declared shared markSignedOut integration remains unavailable for normal ready key removal.).
