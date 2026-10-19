---
id: T-667
kind: task
title: Another stack's verify runs its test in full and reports the test's output
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-666
topic: topic-619
branch: t/T-667-another-stack-s-verify-runs-its-test-in
created: 2026-10-16T16:35:24.761Z
updated: 2026-10-19T20:08:41.363Z
---

## Summary

Coverage selection, the hub and Neovim modes, and the load gate are cland's own and apply only when the candidate carries cland's package runner. Any other project runs its `test` in full, and when it fails, its result shows the failing command and the end of its output (E-614 C3 and C4). Demo: a scratch project with a shell-script test verifies green locally, and red with the test's output after a planted failure.

## What to build

- **cland's own suite.** The candidate carries cland's package runner when `hub/test/run-suite.ts` exists in its worktree. The code already probes that file for runner capabilities (`inheritedLease`, `reduceCoverage`). Put the one predicate in the resolver module and use it everywhere below. Apply it in the hub's submission (`#start`), not inside `selectPackageSuite`, so the selection unit tests keep their temporary repositories.
- **Fixtures.** The fixtures carry the runner stub since ticket T-665. The tests below use its other-stack option.
- **Selection** (`hub/src/suite-selection.ts`, `hub/src/hub/suites.ts`). Without cland's runner, `selectPackageSuite` is not called. The selection is `{ mode: 'full', reason: 'project test runs in full', files }`, with no coverage lookup, no `loadGate`, and no hub shard or duration lint at admission. The cache still keys on the tree, so a green tree is reused as today.
- **Modes.** In such a project, `cland verify hub` and `cland verify nvim` are refused with `hub and nvim are cland's own suite phases; this project's test runs in full: cland verify`. `cland verify` and `cland verify all` are accepted.
- **The result** (`suiteSummary`). Today a run without node test counts reports `counts unavailable (suite did not finish)` and lists failures only as node-test lines. For a run without node test counts, the summary instead names the command that failed and its exit code (`test exited 1: <line>`). It lists the last 20 lines of that command's output under `Failures:`, so a unittest, pytest, cargo or shell failure shows in the result message and not only in the log artifact.

**Keeping cland's own suite intact.** This repository and every task branch of it carry `hub/test/run-suite.ts`, so its selection, coverage, load gate, lint and summary go through exactly today's code. C5 pins that.

## Acceptance criteria

- [x] C1. (T2 submission contract, plus a T3 real-candidate regression) In a temporary project without `hub/test/run-suite.ts`, a submitted verify records mode `full` with reason `project test runs in full`, no `loadGate` and no coverage lookup (suite CLI test with the other-stack fixture).
  - done: impl-667 · 2026-10-19T16:49:21.517Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.145Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
- [x] C2. (T2) In that project `cland verify hub` and `cland verify nvim` are refused with the reason, while `cland verify` and `cland verify all` are accepted (suite CLI test).
  - done: impl-667 · 2026-10-19T16:49:22.264Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.146Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
- [x] C3. (T3, run locally before enqueue; the Linux T3 run is landing evidence) A scratch project with `check = "sh -n test.sh"` and `test = "sh test.sh"` verifies green locally. After a planted failing assertion it turns red, and its result message holds the failing line of the test's output (new CLI test against a temporary project's hub).
  - done: impl-667 · 2026-10-19T16:49:22.933Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.146Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
- [x] C4. (T1) The summary of a failed run without node test counts reads `test exited <n>: <line>` and lists the last 20 output lines, while a node-test log keeps today's summary (unit test on `suiteSummary`).
  - done: impl-667 · 2026-10-19T16:49:23.437Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.146Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
- [x] C5. (existing T3 files, unchanged) A cland-shaped candidate keeps today's coverage selection, modes and load gate, and the existing `suite-selection.test.ts`, `suite-coverage.test.ts` and `suite-selection-report.test.ts` pass unchanged.
  - done: impl-667 · 2026-10-19T16:49:24.049Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.146Z · commit 99e2505d3b1157c238f860525b7b888f202fa292

## Comments

### impl-667 · 2026-10-19T16:20:56.711Z

Implemented the candidate runner capability resolver, full-project submission path, cland-phase refusals, and command-tail summaries. T0 typecheck/static/lint pass. T2 CLI submission tests and T1 summaries pass. Local T3 shell demo passes green/cache/red with assertion output; cland's three C5 T3 files pass unchanged (96 + 2 + 4 tests). Preparing the source-review head; full verification follows the source verdict.

### rev-30 · 2026-10-19T16:23:18.911Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-667-source
commit: 2826705dca165d35f4ca7405ed92680887f37a7a
scope: full
findings: [{"severity":"medium","text":"M1: The last '$ ' line in command output is treated as the executed command. For '$ sh test.sh\\n$ echo preparing\\nassertion failed\\nFinished: exit 1', the result incorrectly names 'echo preparing' and omits part of the command output. Carry an unambiguous command/output boundary (or recorded phase metadata) rather than letting ordinary stdout redefine it; preserve the last 20 actual output lines and add a T1 control.","file":"hub/src/hub/suites.ts","line":111},{"severity":"medium","text":"M2: Missing runner detection handles ENOENT only. A valid other-stack repository with a regular file named hub (or hub/test) has no hub/test/run-suite.ts, but readFile throws ENOTDIR, so #start rejects before the full-project plan. Treat this non-existent runner path as absence while retaining genuine I/O errors, and cover non-directory ancestors.","file":"hub/src/verification-commands.ts","line":10}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear: A-6206. Standards: no separate findings. Spec: M1 command attribution trusts '$ ' stdout; M2 absent runner under non-directory ancestors is rejected. Correct both with T1 controls and request fresh source review before verification. C2/C3/C5 left unverified pending corrected head and gate.

Criteria: C1 failed (A non-directory hub or hub/test ancestor causes ENOTDIR and rejects an absent-runner other-stack project.), C4 failed (Command-like stdout replaces the actual failed command and truncates its output excerpt boundary.).

### rev-30 · 2026-10-19T16:30:42.122Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-source-corrected
commit: b6fb05a8ceb752fc500fe32da4a54908e9d2b221
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, no findings. A-6219 confirms M1 paired command receipts and M2 ENOTDIR handling, plus lower-tier and native contract controls. C1–C5 await same-head mode-free gate plus retained host T3/C5 evidence; no Linux T3 task gate requested.

### rev-30 · 2026-10-19T16:50:28.550Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-final
commit: b6fb05a8ceb752fc500fe32da4a54908e9d2b221
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear: A-6253; C1–C5 verified. Exact-head A-6251/ff2212c5 passes 1591/1591 and 511 groups 5/5; owned submission/absence/summary controls pass. A-6220 retains native shell/remote and unchanged C5 passes; T3 landing remains separate. Four inherited T-856 Git reports retain T-877 disposition, no owned trip.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-19T19:12:58.311Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-integration-source
commit: 38c7889735008f9dddbd2ae1cfca8d1d150b10fc
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6355 Source delta clear: task patch unchanged except correct suites.ts composition of runner guard, batchTiers forwarding and dev-t3 load baseline exclusion. C5 files identical to dev; A-6349 original targeted/native host captures audited, distinct from pending task gate. Inherited verify-tool fixture is unchanged from dev and tracked T-891 (A-6332/A-6344), so shared correction disposition is needed before new verify; any changed head receives fresh delta review. C1–C5 not verified at new head yet.

### rev-30 · 2026-10-19T19:22:12.799Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-revised-shared-fixture-source
commit: 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6392 cumulative shared-fix source clear. Net only verify-tool.test.ts+7/-1 from 38c78897; blob exactly equals T-891 final67a01b6f. Coordinator151c645e authorization; all original task source unchanged, assertions preserved. Runtime C1–C5; prior A-6349 host evidence remains distinct from Linux task gate; new exact-head mode-free receipt required, no criteria verified yet.

### rev-30 · 2026-10-19T19:30:16.011Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-integrated-final
commit: 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6421 Exact-headA-6418/c59ce1e1 final clear: ordinary1625/1625,0fail/cancel/skip/TODO, all37groups5/5, no owned budget/resource rows. Owned criterion proofs audited; C3/C5 native hostA6349 remain source-identical/separate from Linux task; sourceA-6355/A-6392. Allcriteria verified; unownedT883 budgets separately owned, no taskT3claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-19T19:48:10.079Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-periodic-search-integration-source
commit: 99e2505d3b1157c238f860525b7b888f202fa292
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-6495. Full task-patch comparison preserves old behavior except expected cland-runner guard now encloses upstream periodic-probe/batch files, plus authorized fixture materialization of historical cland package/runner. All assertions and upstream search/result/worker behavior retained. A-6489 raw15serialfiles173/173 pass zero fail/cancel/skip/TODO; correctedT2 cases1.696/1.237s. NativeC3 shell7.501s and C5 96+2+4 checks green locally, not Linux evidence. No tier/allowance/newproductionworkaround. Fresh exact-head mode-free gate required; priorA6418 historical; QA none.

### rev-30 · 2026-10-19T20:00:36.146Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-periodic-search-integrated-final
commit: 99e2505d3b1157c238f860525b7b888f202fa292
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final current-head evidence clear, A-6529. Independently audited A-6524 exact-head mode-free b80d897a: 1656/1656, zero fail/cancel/skip/TODO, all 70 load groups 5/5, no resource mismatch or owned budget trip. C1/C2 capability/submission/CLI and C4 summary controls ordinary plus repetitions pass within case budgets; integrated historical-candidate fixture controls ordinary and five repetitions also pass. Source delta A-6495 and retained local C3/C5 native/selection proofs A-6489 cover integrated source. All C1–C5 verified. Linux T3 remains periodic/integrated, absent from configured batch tiers; QA none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
