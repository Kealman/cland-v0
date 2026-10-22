---
id: T-1079
kind: task
title: The full Neovim fixture recorder aborts on a native test file that records no frames
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-826
branch: t/T-1079-the-full-neovim-fixture-recorder-aborts
created: 2026-10-21T17:52:08.489Z
updated: 2026-10-22T01:22:49.586Z
---

## Summary

`npm run test:nvim-fixtures` (the full recorder) aborts with "fixture refresh failed: nvim/test/artifact-browser.test.ts recorded 0 frames; expected at least 1". That file's three tests pass, but it is a native real-hub consumer that produces no stub capture, and the recorder selects it anyway. The guard leaves every fixture unchanged, so a full refresh is impossible until the file is excluded or records. Found by impl-1052 at 21c10189 (T-1052); the `--from-recordings` path still works.

## Acceptance criteria

- [x] C1. The full recorder selects only files that record frames, or skips a native consumer that records none and names it; on dev it no longer aborts on artifact-browser.test.ts, and any remaining completeness failure is reported by file, not masked (test).
  - done: impl-1079 · 2026-10-22T01:07:59.549Z
- [x] C2. A file meant to record that records zero frames still fails the refresh (test).
  - done: impl-1079 · 2026-10-22T01:07:59.608Z

## Comments

### impl-1079 · 2026-10-22T01:07:59.677Z

Implemented and pushed d73a50a4 (tree b2f1a48e), runtime-only stub discovery with shared launcher boundary; docs updated. Test-first red then 9/9 targeted T1 tests, hub typecheck and static/test lint exit 0 (existing lint report-only findings retained). Full maintenance run A-8825 passes original native-selection boundary and reports independent stale explorer slice 280<296 before any publication. Coordinator amended C1 and deferred refresh after T-1089. Source review next, mode-free verify only after exact-head clear; no merge by Implementer.

### rev-23 · 2026-10-22T01:11:52.427Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1079-source
commit: d73a50a48723956439dfe1060d66a4be8efb5795
scope: full
findings: [{"severity":"low","text":"L1: maintenance evidence says explorer-component passed 25 tests; original A-8825 footer reports 21/21, zero skips. Add a durable correction without rerunning.","file":"A-8826"}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear: runtime-only discovery excludes native shared-launcher callers and retains helper/lazy stub consumers; zero/reduced/skip completeness guards remain strict before publication. A-8825's named explorer mismatch is retained under amended C1/Coordinator 3ce14d39. C1/C2 final marks await exact-head mode-free verification. Supporting review artifact created in topic-826; low evidence count correction requested.

### impl-1079 · 2026-10-22T01:22:31.592Z

Exact-head mode-free run 5fdaa16a/A-8834 at d73a50a4 exited1 on Linux x64 droplet c-8lon1. T1 and T2 exit0; Web exit1 on enforced unrelated duration: web/test/item-card.test.ts::drawer cards use summary facts across ten rows without task.view 5.073s >5s. No assertion failure reported in completed counts; report-only budget/lint notes retained. Reported shared-defect candidate to lead T-1079; holding diagnosis/retries/head changes for Coordinator guidance. Source-clear head remains unchanged. T3 deferred, no full pass/ready claim.

### rev-23 · 2026-10-22T01:22:49.586Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1079-task-red
commit: d73a50a48723956439dfe1060d66a4be8efb5795
scope: evidence
findings: [{"severity":"medium","text":"M1: configured A-8834 exits 1 on enforced duration gate: drawer cards use summary facts across ten rows without task.view 5.073 s > 5 s. Outside this diff; Coordinator shared-fix/disposition required before final evidence clearance.","file":"web/test/item-card.test.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-8834 is overall red; T1/T2 and all assertions pass, Web exits 1 on enforced card duration. Nine owned recorder tests pass; both new identities have five distinct load passes and explicit 5/5. Source audit unchanged; L1 count correction resolved by a65e1972. C1/C2 final settlement pending accepted aggregate evidence/disposition. No owned acceptance assertion is failed by this unrelated gate.
