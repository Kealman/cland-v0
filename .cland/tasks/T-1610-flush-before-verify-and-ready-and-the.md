---
id: T-1610
kind: task
title: Flush before verify and ready, and the clause
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1609
topic: topic-1385
branch: t/T-1610-flush-before-verify-and-ready-and-the
created: 2026-11-02T03:33:57.872Z
updated: 2026-11-04T20:42:20.939Z
---

## Summary

`cland verify` and setting an item `ready` from a host session first ask the host's agent to flush the task branch's push. The CLI reports the worktree's HEAD, and the hub compares it with the territory head, refuses a mismatch naming both, and verifies from the territory branch, never from the session's directory. The Implementer's clause says that cland pushes the task branch for host sessions, within the clauses' byte reserve.

Hot files: `hub/src/hub/dispatch.ts`, `hub/src/cli/suite.ts`, `hub/src/cli/task.ts`, `hub/src/roles/default-roles.ts`, `hub/test/host-flush.test.ts` (new)

## Acceptance criteria

- [x] C1. `cland verify` from a fake host session whose last commit was not yet pushed waits for the flush and runs at the territory head equal to the reported HEAD (test).
  - done: impl-1610 · 2026-11-04T20:30:17.506Z
- [x] C2. `cland task edit <id> --status ready` from a host session flushes first, and is refused with both heads named when the territory head still differs after the flush (test).
  - done: impl-1610 · 2026-11-04T20:04:32.799Z
- [x] C3. A verify from a host session never reads the session's working directory on the hub's machine (test).
  - done: impl-1610 · 2026-11-04T20:27:04.414Z
- [x] C4. Local sessions' verify and ready behave as today, and the verify-cli and task-cli test files pass with no test edited.
  - done: impl-1610 · 2026-11-04T20:04:33.057Z
- [x] C5. The Implementer's clause has one sentence saying that on a host cland pushes the task branch on every commit, and `roles-clauses.test.ts` passes with its reserve and growth ceilings unchanged.
  - done: impl-1610 · 2026-11-04T20:04:33.313Z

## Notes

Shared files: `hub/src/hub/dispatch.ts` (verify submission and `task.edit` status), `hub/src/roles/default-roles.ts` (sole clause edit in E-1532)

## Comments

### impl-1610 · 2026-11-04T19:45:44.050Z

Rule 20 pre-edit inventory: suite.start consumers are cli/suite.ts, hub dispatch/protocol/suites, MCP verify tool (tool-arguments/tool server), suite previews/selection and verify CLI/dispatch tests; task.edit ready consumers are cli/task.ts, tracker tools/requests, dispatch/core readiness, MCP task_edit, nvim items/graph/plan/vboard/marks and web ItemsTree/client, their protocol frame fixtures. Searched field/frame/status names across hub/src, all test tiers, nvim, web, qa briefs/cases, docs and shipped skills. Human clients and old/local wire shapes remain accepted; host-only admission will bind to durable worktree ownership and use the existing agent flush producer, with additive optional HEAD reporting. Shipped implement guidance, host-agent/SSH docs and CLI help need updates; archived QA examples remain compatible. No new push implementation.

### impl-1610 · 2026-11-04T20:05:12.487Z

Implementation/source review requested at 1db5854f7a908bf470d22b11c44210db206898f6, tree 0fb9d133c36c47cfd00307a7844181f870e45930. C1-C5 done. Pre-edit consumer inventory in initial comment; expanded field/frame/function-name sweep attached as admission consumer inventory artifact. Updated shared wire types and wire-only CLI validation, CLI help usage fixture, internal scheduler source/checkpoint ownership, agent closure, docs/skill change record and both clauses. Nvim/web/QA/old MCP callers retain the previous shape; additive CLI HEAD is corroborated on the owning Host. T0 check green (A-16679), local supplemental CLI41/41 (A-16680) and boundaries74/74. Stage is review-only, no per-item QA. Exact committed-head preservation receipt is running; configured verification follows clear source review only.

### rev-35 · 2026-11-04T20:15:07.409Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1610-source-1
commit: 1db5854f7a908bf470d22b11c44210db206898f6
scope: full
findings: [{"severity":"medium","text":"Retry failed startup snapshot sweeping on a later host admission. #hostSnapshotRecovery is assigned once and retains a rejection; a transient TerritoryBusy or orphan-removal failure permanently rejects every later source admission at line533 even after the blocker disappears.","file":"hub/src/hub/suites.ts","line":376},{"severity":"medium","text":"Bind host verification snapshots to confined parent/leaf directory identities before creation, reuse and force removal. mkdir follows a planted host-verify ancestor symlink; cleanup trusts only Git's registered pathname and may remove a replacement directory. The territory lock does not establish ownership of this snapshot path.","file":"hub/src/territory.ts","line":1001},{"severity":"medium","text":"Classify host verification before ProcessTable publication using authenticated host launch/transport or durable claimed-item host ownership. hostForSession defaults to local when the process row is absent, so omitted-cwd verify can select the hub-local task path and bypass host flush during an accepted host launch.","file":"hub/src/hub/dispatch.ts","line":2249}]
finding_counts: {"high":0,"medium":3,"low":0}

Full Standards/Spec source not clear: three medium findings, each confirmed by implementer. Normal Host flush/HEAD corroboration, explicit/automatic-ready authority revalidation, additive wire compatibility, help fixtures/docs/guides/index/consumer inventory/clause checked. All32 closure hashes match. A-16682 local74 and A-16683 local124 named passes supplement only; no configured verify/Linux/Web/QA claim. Working-tree repairs reported in55845289 are outside this pin; fresh pushed-head full source review precedes verification. C1/C3 failed; C2/C4/C5 unverified. New source findings artifact carries traces and required controls. No Reviewer tests/probes/browser/edits/Git mutation/delegation.

Criteria: C1 failed (Snapshot startup sweep cannot retry after transient rejection, and source creation/removal lacks confined exact directory ownership.), C3 failed (An admitted host session before ProcessTable publication can take omitted-cwd local verification and bypass flush.).

### rev-35 · 2026-11-04T20:19:14.141Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1610-source-2
commit: c88a3b7c7bec5223716c517383951724fd7a13cc
scope: full
findings: [{"severity":"medium","text":"Reconcile failed/interrupted snapshot preparation. The directory/ready:false receipt precedes Git, but preparation has no cleanup catch; it is outside the caller try/finally. Sweep validation always rejects incomplete/missing receipts, so Git failure or loss of ready publication leaves permanent unreachable source/Git registrations. Retain positive producer/native closure and interrupted-effect recovery without unsafe replay or inherited signal authority.","file":"hub/src/territory.ts","line":1044}]
finding_counts: {"high":0,"medium":1,"low":0}

Full repair source not clear: one medium, confirmed d41109f6. A-16686 three original findings resolved: retryable isolated sweeps; confined durable identity validation for normal create/reuse/execution/removal; host transport/durable owner classification before process publication. A-16687 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16687-t-1610-repair-review-interrupted-snapshot-preparation-lacks-settlement-owner.md records remaining incomplete-preparation boundary and controls. All32 closure hashes match; docs/inventory/duration delta checked, prior full Host/wire/ready/help/clause review carries. Local predecessor/working-tree receipts supplemental, final reuse test pending; no configured same-head/Linux/Web/QA claim. C1 failed; C2–C5 unverified. Escalated recovery seam needs correction and fresh source review before verify. No Reviewer runtime/probes/browser/edits/Git mutation/delegation.

Criteria: C1 failed (Failed/interrupted native snapshot preparation has no same-lifetime cleanup or durable reconciliation owner; repeated ready:false retention cannot settle admission.).

### impl-1610 · 2026-11-04T20:21:14.026Z

Coordinator decision 13e9edef supersedes the proposed native reconciliation owner: snapshots are derivable; never complete ready:false. Re-admission uses a new unique path. Interrupted sources remain cleanup-pending and are removed only after a bounded Git-lock census clears, using captured parent/leaf authority and the existing worktree removal helper. No PIDs/signals/maintenance. At most one abandoned source per run (source UUID is its run identity). Adding status leftovers and held/faulted preparation controls. Shared contract consumer sweep for additive hub.status hostSnapshotLeftovers covers protocol/shared wire conformance, dispatch, CLI hub status, nvim/web snapshot decoders and old status fixtures; optional field leaves previous hubs/clients valid.

### rev-35 · 2026-11-04T20:29:45.860Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1610-source-3
commit: 812a6ff36052b9c4d34c6a6d797ae1742ddc2391
scope: full
findings: [{"severity":"medium","text":"Require positive registered-snapshot Git admin ownership before lock-clear cleanup. Catch-all gitdir read failure becomes an empty unrelated owner, so the owning index.lock/locked directory can be skipped and force removal attempted. Retain ambiguous reads and require exactly one matching admin; add missing/unreadable-backpointer refusal and restored-owner cleanup control.","file":"hub/src/territory.ts","line":1100}]
finding_counts: {"high":0,"medium":1,"low":0}

Full repair source not clear: one medium, confirmed d33bd29d. Coordinator13e9edef independently read: abandonment/fresh-path/lock-gated cleanup supersedes producer reconciliation from A-16687; accepted design has no replay/PID/signal/maintenance. Prior three source findings remain repaired. A-16691 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16691-t-1610-abandonment-review-git-admin-ownership-must-be-positive-before-cleanup.md records remaining ambiguous-admin read, tests and evidence limits. Optional/null status and old shape, CLI/help fixture/docs/guides/state/skill inspected; all32closure hashes match. Temporary6.09/4.747s C216 allowances explicitly predecessor macOS1.5x projections. Pending final-native/T0 and predecessor125/74 supplements are not configured current-head/Linux/Web/QA evidence. C1 failed,others unverified; fresh corrected-head source before verify. No Reviewer runtime/probes/browser/edits/Git mutation/delegation.

Criteria: C1 failed (Abandoned-source cleanup can declare the Git-lock census clear without positively binding the registered source's owning admin directory.).

### rev-35 · 2026-11-04T20:30:59.388Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1610-source-4
commit: 107b3bb653ca9b29f32a05fbcc9db6cb33ab993c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, no findings. A-16691 resolved: ambiguous admin reads retain, registered source requires exactly one positive admin binding before lock-clear cleanup; native backpointer fault/guide added, remaining runtime unchanged. A-16692 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16692-t-1610-full-source-clear-flush-admission-and-owned-snapshot-abandonment.md records carry and limits. Prior Host/HEAD, actor/ready, pre-process classification, retryable sweep, confined durable snapshot ownership, additive wire/status/help/docs/index/state/skill/clause inspection carries. All32 closure hashes match. Coordinator13e9edef abandonment policy explicit; no replay/PID/signal/maintenance. Current hub typecheck reported green; prior local4/125 and74 receipts supplemental. Final native fault delta/T0 pending slot; no configured same-head/Linux/Web/QA evidence, C1–C5 unverified. Exact-head modefree verify may follow pending authorized checks; changed head needs fresh source review. No Reviewer runtime/probes/browser/edits/Git mutation/delegation.

### rev-35 · 2026-11-04T20:42:20.939Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1610-source-5
commit: be42f36a20066bb9335c5ea3084a714af9f88078
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear,no findings. Complete delta only two existing allowance values/reasons; full A-16692 source review carries with runtime/tests/assertions/cleanup/roles/docs unchanged. A-16695 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16695-t-1610-allowance-refresh-source-clear-at-be42f36a.md. A-16693 four native named passes read;4.244567042×1.5 rounds up6.367 and5.038113×1.5 rounds up7.558,C216/Nov11 unchanged; whole-case concurrent-T0 observations/projections explicitly qualified. Log lacks separate native/wrapper exit receipt, preserve provenance for final evidence. A-16694 reportedT0exit0 began107b and allowance edit overlapped; development/runtime evidence,not clean exact-be42 T0. No configured same-head/Linux/Web/QA evidence,C1–C5unverified. Exact-head modefree verify may proceed; no rule7 evidence carry exception claimed. No Reviewer runtime/probes/browser/edits/Git mutation/delegation.
