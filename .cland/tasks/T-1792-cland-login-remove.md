---
id: T-1792
kind: task
title: "`cland login remove`"
state: open
status: ready
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
updated: 2026-11-11T14:42:07.713Z
---

## Summary

`cland login remove <name>` deletes a disk login's volume and every snapshot, each confirmed by a read, then its row. For a key login it deletes `.cland/auth/<name>.key` and the row. The command is refused while the login is in use, naming the host.

## What to build

The `login.remove` frame and `cland login remove`. A deletion the provider does not confirm keeps the row with the ids that remain, and the command exits nonzero naming them, so a rerun finishes the work. Removing a `creating` login is refused while its sign-in runs. The `[auth]` store key is never removed.

## Acceptance criteria

- [x] C1. `cland login remove` of an in-use login is refused naming its host and changes nothing (test).
  - done: impl-1792 · 2026-11-11T12:27:41.401Z
  - verified: rev-37 [reviewer] · run rev-37-1792-evidence-1 · 2026-11-11T14:42:07.457Z · commit ac2ffe26627319218dbc1b11faa8e33a3289b639
- [x] C2. After that host stops, the same command deletes the volume and both snapshots with confirming reads, and the login leaves `cland login list` (test).
  - done: impl-1792 · 2026-11-11T12:27:42.856Z
  - verified: rev-37 [reviewer] · run rev-37-1792-evidence-1 · 2026-11-11T14:42:07.457Z · commit ac2ffe26627319218dbc1b11faa8e33a3289b639
- [x] C3. A deletion the provider does not confirm keeps the row with the remaining ids, and the command exits nonzero naming them (test).
  - done: impl-1792 · 2026-11-11T12:32:35.042Z
  - verified: rev-37 [reviewer] · run rev-37-1792-evidence-1 · 2026-11-11T14:42:07.457Z · commit ac2ffe26627319218dbc1b11faa8e33a3289b639
- [x] C4. Removing a key login deletes its key file and its row, and leaves the `[auth]` key (test).
  - done: impl-1792 · 2026-11-11T12:27:43.420Z
  - verified: rev-37 [reviewer] · run rev-37-1792-evidence-1 · 2026-11-11T14:42:07.457Z · commit ac2ffe26627319218dbc1b11faa8e33a3289b639
- [x] C5. Removing a `creating` login is refused naming the running sign-in (test).
  - done: impl-1792 · 2026-11-11T12:27:43.625Z
  - verified: rev-37 [reviewer] · run rev-37-1792-evidence-1 · 2026-11-11T14:42:07.458Z · commit ac2ffe26627319218dbc1b11faa8e33a3289b639

- [x] C6. When a deletion is not confirmed and the row stays, the confirmed deletions are recorded through LoginRecords.deleteStorage and only the unconfirmed items keep accruing in host status; a fully removed login's storage leaves host status with its row, as docs/hub/logins.md then states (test).
  - done: impl-1792 · 2026-11-11T12:32:36.543Z
  - verified: rev-37 [reviewer] · run rev-37-1792-evidence-1 · 2026-11-11T14:42:07.458Z · commit ac2ffe26627319218dbc1b11faa8e33a3289b639
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

### impl-1792 · 2026-11-11T12:28:22.649Z

Authorized integration complete: origin/dev merged once under Coordinator 3876ab25 (T-1793 landed 15ee52343), conflicts were only combining logins.ts imports and additive private-column migrations; both preserved. Pushed head 303aeef28a26df6bb65267fe3da111341661bcef. Removal now calls LoginRecords.markSignedOut(name,{reason:'removing',host:null}) directly in beginRemove; injected seam/probe removed from production and tests. Ready key and ready disk CLI tests pass. New CLI partial-delete case proves nonzero result/remaining volume, real signedOut id/reason/host/store-clock, capacity exclusion and sign-in fence; new two-start projectHub case proves startup reconciliation preserves both private claims and every resource. Reconciliation runs after sshHosts startup and before restoreWaitingLaunches; it never writes removing/snapshot_admission, and settledLogin now seeds provider-backed volumes. Extended graph A-18676 has 699 reached + 15 unknown on added seams, union with original conservative graph is 717; A-18677 enumerates settledLogin consumers. A-18674: 129 local macOS Node24.21.0 T1/T2 tests passed on integration runtime tree 5ea4ce568 (303aeef28 adds only a documentation wording fix); A-18675 exact TMPDIR 9874→9874, appeared/disappeared empty. Hub typecheck and closed-item lint pass at final head. All C1–C6 marked done. Native slot and configured Linux verify remain unrun pending source review. Proposed native subset after clearance: host-create-ready, host-destroy-native, host-restart, login-add, login-exclusive-native, login-key-spawn, login-terminal, login-write-back, one file at a time under preservation lock; full T3 remains batch, T4 stage/epic.

### rev-37 · 2026-11-11T12:31:18.152Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1792-source-3
commit: caae588dd6b9a9cbf10017343ee7ea9876f219bc
scope: delta
findings: [{"severity":"medium","text":"assertSnapshotSettled runs before retained positive receipt repair. Accounting failure leaves receipt+admission; direct removal marks signed-out/removing then always rejects this check, so neither retry/restart nor ordinary snapshot can recover. A-18681 reproduces both paths. Let snapshot owner's beginRemoval validate/settle known receipt+accounting first; keep no-receipt unknown work fenced.","file":"hub/src/host/login-snapshots.ts","line":192}]
finding_counts: {"high":0,"medium":1,"low":0}

Integrated delta review at caae588dd6b9a9cbf10017343ee7ea9876f219bc is not clear, one medium finding. Exact failure before diagnosis: 'known positive snapshot receipt must be repaired by removal owner without an intervening snapshot retry'; A-18681/A-18682 same-owner/reopened-store controls observe repeated 'login snapshot outcome requires reconciliation' while known receipt+admission and signed-out/removing row remain. These are Implementer-executed macOS Node24.21 receipts, not Reviewer runs. Prior accounting atomicity and real markSignedOut integration findings are resolved by source. Reviewed both Coordinator-authorized merges3876ab25/10eac78c, additive-column/import conflict union, direct ready disk/key receipt tests, startup two-hub claim preservation, provider/accounting/authority/docs integration. Extra merge from303aeef28 to this head is only dev's exact wording. A-18683 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18683-t-1792-integrated-delta-at-caae588dd-known-receipt-removal-retry-blocked.md) has complete assessment/limits. A-18674 reports129 supporting localT1/T2 passes on runtime-equivalent5ea4ce568; no exact-head configured Linux/native/fullT3/T4/QA pass claimed. No Reviewer tests/typecheck/native/browser. C3/C6 failed, no criteria verified; C1/C2/C4/C5 pending runtime evidence. Keep717 conservative consumers plus explicit/settledLogin callers; repair direct removal before fresh exact-head source review and planned native/verify.

Criteria: C3 failed (Direct remove/retry after a known positive snapshot accounting failure is permanently fenced, including reopened-store path.), C6 failed (The removal owner cannot reach retained-receipt accounting repair once its signed-out/removing claim is taken.).

### rev-37 · 2026-11-11T12:33:46.077Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1792-source-4
commit: dff15fef70b7cee29992e2bbd9f9978fd966e02a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact dff15fef70b7cee29992e2bbd9f9978fd966e02a, no remaining high/medium/low findings. Retained positive snapshot receipt/accounting repair now precedes assertSnapshotSettled within the snapshot owner, while unknown/no-receipt admissions and unresolved thaw remain fenced. Four new direct-remove generated controls retain same-owner/reopen and success/partial-delete final receipt/accounting assertions without an intervening snapshot retry. All earlier source findings resolved: durable unknown fence, atomic lifetime/receipt settlement, real shared markSignedOut ready disk/key integration, ordered held teardown, golden and permission docs. Both authorized integration/wording merges were reviewed in the prior delta; no further merge in this correction. A-18688 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18688-t-1792-source-clear-at-dff15fef7.md) records complete assessment and limits. No criteria verified here: C1–C6 all await exact-head runtime facts. A-18686 reports133 local macOS Node24.21 T1/T2 passes/static checks; Reviewer ran no tests/native/browser/typecheck and claims no configured Linux or fullT3/T4/QA pass. Planned exact-head eight-file local native subset and mode-free configured verification may proceed under project admission; any head change needs fresh source review. Retain717 conservative consumers plus explicit/settledLogin callers in final actual-file/case reconciliation. FullT3 batch, broaderT4 and affected after-stage QA remain separate.

### hub · 2026-11-11T14:12:02.960Z

Merge-delta assessment (report-only)
{"reviewed":"dff15fef70b7cee29992e2bbd9f9978fd966e02a","head":"d93b33fd4fd605141df540aa620580067df62169","dev":"a38929ae8b2ed60cc7e2a50abd02735b7f3c6094","mergeBase":"10711a330d6f90bf9d6b218e9bdefd1eb3224f76","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":[".agents/skills/implement/CHANGES/T-1792-login-remove.md",".agents/skills/implement/SKILL.md","docs/agents/auth.md","docs/agents/session-permissions.md","docs/agents/tests/hub-test-login-remove.test.ts.md","docs/agents/tests/index.md","docs/hub/logins.md","hub/README.md","hub/src/cli/help.ts","hub/src/cli/login.ts","hub/src/cli/usage/login.ts","hub/src/host/login-keys.ts","hub/src/host/login-remove.ts","hub/src/host/login-snapshots.ts","hub/src/host/logins.ts","hub/src/hub/dispatch.ts","hub/src/hub/web-authority.ts","hub/src/protocol.ts","hub/test/fixtures/cli-usage/commands.json","hub/test/login-list.test.ts","hub/test/login-remove.test.ts","hub/test/tiers.json","shared/wire/index.ts"],"devPaths":[".agents/skills/implement/CHANGES/T-1810-terminal-release.md",".agents/skills/implement/SKILL.md","docs/agents/tests/hub-test-host-restart.test.ts.md","docs/agents/tests/hub-test-login-release.test.ts.md","docs/hub/host-providers.md","docs/hub/logins.md","hub/README.md","hub/src/host/login-release-policy.ts","hub/src/host/provision-host.ts","hub/test/host-restart.test.ts","hub/test/login-release.test.ts"],"overlap":[".agents/skills/implement/SKILL.md","docs/hub/logins.md","hub/README.md"],"dependency":{"status":"unknown","reason":"import graph incomplete or budget exceeded"},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### rev-37 · 2026-11-11T14:13:35.283Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1792-delta-1
commit: d93b33fd4fd605141df540aa620580067df62169
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1810 merge delta source clear at d93b33fd4fd605141df540aa620580067df62169; no findings. Reviewed clean authorized Coordinator036d7b6a merge of dff15fef7 with a38929ae8, all11 incoming paths and shared release-owner interactions. Terminal destroyHostOnce retries retained login cleanup without provision writes, machine re-deletion or spend/lease resettlement; retained incomplete ownership stays with the existing bounded owner. Deterministic/native assertions observe exact durable settlement/commit transitions, join retries and retain final lease/spend/live/watchdog checks. Docs/skill changes match. Task removal/snapshot/store/authority runtime remains source-clear ancestor unchanged. A-18744 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18744-t-1792-t-1810-merge-delta-source-clear-at-d93b33fd4.md) records assessment and limits. No criteria verified: C1–C6 await this head's fresh runtime evidence. Original two host-restart failures remain red ('destroying' vs 'destroyed'); caller traces/diagnostic passes are not pass carry. Implementer reports47 local macOS Node24.21 T2 passes and hub typecheck; Reviewer ran no tests/native/browser/typecheck. Fresh full directed eight-file admitted native set then mode-free configured Linux verification may proceed at this exact head. Consumer-union reconciliation, full remainingT3 batch, broaderT4 and affected after-stage QA remain separate.

### rev-37 · 2026-11-11T14:17:18.926Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1792-delta-2
commit: ac2ffe26627319218dbc1b11faa8e33a3289b639
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Manifest-order delta source clear at ac2ffe26627319218dbc1b11faa8e33a3289b639, no findings. Full diff only reorders the identical login-remove T2 entry after login-release/before login-selection. Read-only parsed JSON equality confirms no manifest value change and all test paths sorted; no source/import/test-body/fixture/docs change. A-18754 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18754-t-1792-manifest-order-delta-clear-at-ac2ffe266.md) records assessment. Coordinatorcd633ecf permits original-head d93b33fd4 native8/25case support A-18745–18753 to carry because executable/test bytes are unchanged; not a fresh ac2ffe execution claim. Implementer reports test:tiers pass free213/machine609; Reviewer ran no tests/native/browser/typecheck. Previous verify was refused pre-admission, not queued or passing. C1–C6 remain runtime-unverified; exact-head configured verification may proceed. Prior source assessment A-18744 remains; original native failures preserved. Full remainingT3/T4/affected after-stage QA separate.

### impl-1792 · 2026-11-11T14:40:01.493Z

Completion evidence at clean final head ac2ffe26627319218dbc1b11faa8e33a3289b639: configured mode-free fresh Linux droplet run8a65dcbb-43da-4810-9bf2-2133b35a7cc8 passed6040/6040, no failures/skips/cancellations (A-18755). T0,T1,T2 fallback full,Web and changed-T3 duration slice passed; slice is host-restart/host-relaunch,5 named base cases. A-18756 verifies all21 generated login-remove case identities, each1 base+5 repeated pass events and explicit5/5 load receipt; max named1.713s. Executor Linux x64 6.8.0-147-generic,Node24.21.0,Neovim0.12.5,Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4; lifetime1147s,cost$0.0796. Lint/duration/advisory findings report-only. Native evidence A-18745–A-18753 is25/25 across8 files on macOS Node24.21.0 at ORIGINAL d93b33fd4, no skips/browser, TMPDIR9876→9876 no differences. Coordinatorcd633ecf permits carry to ac2ffe266 only because its entire delta moves the identical login-remove T2 manifest entry after login-release; no source/import/body change. Prior native reds and timestamped inherited T-1810 diagnosis retained; T-1810 landed before clean native rerun. Static717+explicit consumer dispositions are A-18694, not executed coverage; configured fallback covers T1/T2/Web while remaining fullT3 stays in merge batch and T4/affected after-stage QA stays stage/epic. AllC1–C6 done. Reviewer received exact-head result and named/native facts for same-head final settlement; no further merge/source edits.

### rev-37 · 2026-11-11T14:42:07.458Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1792-evidence-1
commit: ac2ffe26627319218dbc1b11faa8e33a3289b639
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; no findings on Standards or Spec. C1–C6 verified against reviewed assertions and executed run 8a65dcbb/A-18755 (6040 passed, zero fail/cancel/skip/todo), including all 21 generated login-remove identities with one base plus five repeated passes each. Independently recomputed canonical tree b000e0ad0e82ed1207d5b245a45d2db1e68289df matches provenance and branch head. T0/all T1/fallback all T2/Web and two selected T3 files (five identities) completed on Linux x64 droplet c-8 lon1, Node24.21.0/Neovim0.12.5, isolated Headless Shell1248 Chrome for Testing156.0.8078.4; uncached. Native eight-file 25/25 macOS receipts A-18745–18753 are explicitly carried from d93b33fd4 under Coordinator cd633ecf across manifest-order-only delta, not claimed as exact-head native execution. Conservative 717-path inventory reconciled: all75 T1/343 T2/52 Web files have passing named records; 2/233 T3 configured, 0/14 T4. Remaining full T3, T4 occasions and affected after-stage QA remain separate; budgets/lint/ratchet/skip-reason notices report-only. Criterion mapping, named facts, original red history and limits: A-18757, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18757-t-1792-final-same-head-review-and-criterion-evidence.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
