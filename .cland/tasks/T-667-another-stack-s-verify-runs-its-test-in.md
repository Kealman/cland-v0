---
id: T-667
kind: task
title: Another stack's verify runs its test in full and reports the test's output
state: closed
status: done
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
updated: 2026-10-19T21:32:45.524Z
closed: 2026-10-19T21:32:45.524Z
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
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.145Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
  - done: impl-667 · 2026-10-19T21:27:55.575Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-shared-fixture-final · 2026-10-19T21:28:12.303Z · commit aba5deabaf78aff471b96db48b6252fcf39abff2
- [x] C2. (T2) In that project `cland verify hub` and `cland verify nvim` are refused with the reason, while `cland verify` and `cland verify all` are accepted (suite CLI test).
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.146Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
  - done: impl-667 · 2026-10-19T21:27:56.189Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-shared-fixture-final · 2026-10-19T21:28:12.303Z · commit aba5deabaf78aff471b96db48b6252fcf39abff2
- [x] C3. (T3, run locally before enqueue; the Linux T3 run is landing evidence) A scratch project with `check = "sh -n test.sh"` and `test = "sh test.sh"` verifies green locally. After a planted failing assertion it turns red, and its result message holds the failing line of the test's output (new CLI test against a temporary project's hub).
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.146Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
  - done: impl-667 · 2026-10-19T21:27:56.689Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-shared-fixture-final · 2026-10-19T21:28:12.303Z · commit aba5deabaf78aff471b96db48b6252fcf39abff2
- [x] C4. (T1) The summary of a failed run without node test counts reads `test exited <n>: <line>` and lists the last 20 output lines, while a node-test log keeps today's summary (unit test on `suiteSummary`).
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.146Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
  - done: impl-667 · 2026-10-19T21:27:57.277Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-shared-fixture-final · 2026-10-19T21:28:12.303Z · commit aba5deabaf78aff471b96db48b6252fcf39abff2
- [x] C5. (existing T3 files, unchanged) A cland-shaped candidate keeps today's coverage selection, modes and load gate, and the existing `suite-selection.test.ts`, `suite-coverage.test.ts` and `suite-selection-report.test.ts` pass unchanged.
  - verified: rev-30 [reviewer] · run rev-20261019-667-final · 2026-10-19T16:50:28.550Z · commit b6fb05a8ceb752fc500fe32da4a54908e9d2b221
  - verified: rev-30 [reviewer] · run rev-20261019-667-integrated-final · 2026-10-19T19:30:16.011Z · commit 9c9a9fd6923fe08900095c6f8a85bd2df6dcfd03
  - verified: rev-30 [reviewer] · run rev-20261019-667-periodic-search-integrated-final · 2026-10-19T20:00:36.146Z · commit 99e2505d3b1157c238f860525b7b888f202fa292
  - done: impl-667 · 2026-10-19T21:27:57.763Z
  - verified: rev-30 [reviewer] · run rev-20261019-667-shared-fixture-final · 2026-10-19T21:28:12.303Z · commit aba5deabaf78aff471b96db48b6252fcf39abff2

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

### rev-30 · 2026-10-19T20:29:18.485Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-landed-proof-shared-fix-source
commit: 35effc9e31a5b2fdee4c4c4d6d51c2bcd05ea571
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Combined delta source clear, A-6635. Direct Coordinator history confirms merges and exact T-907 exception to C5 unchanged-file wording. Independent task-patch comparison shows only new landed-identity lookup runner guard and posted one-line obsolete T4 expectation fix; all other owned patches unchanged. Preserves T-885 proof persistence/exact-head lookup, T-893 periodic tiers and arbitrary-stack full/no-cland-planning behavior. Raw A-6630 fifteen files184/184; C3 shell3.179 s, C5 selection96/96+coverage/report passes qualified local. C1–C5 await fresh exact-head mode-free gate; previous evidence historical. QA none.

### rev-30 · 2026-10-19T20:39:00.484Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-667-landed-proof-runtime
commit: 35effc9e31a5b2fdee4c4c4d6d51c2bcd05ea571
scope: evidence
findings: [{"severity":"medium","text":"Exact-head A-6654 exits 1: red-singleton history assertion cannot find its expected T1,T3 notice; the code-movement case at line 337 also cannot find the original green notice. These two non-report-only assertion failures prevent final gate settlement; lead/Coordinator disposition is required before shared diagnosis/fix/retry.","file":"hub/test/merge-queue.test.ts","line":240}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6660 records independent raw A-6654 audit: ordinary 1510/1508/2, all 155 completed load groups 5/5, no tier/resource mismatch. Source A-6635 remains clear, but final C1–C5 are not newly verified because current-head gate af62ebd2 is red. Retain failed receipt/head; no defect attribution or diagnosis beyond the raw assertions, and no Reviewer tests/reruns. Request lead/Coordinator disposition under rule 11.

### impl-667 · 2026-10-19T20:49:13.284Z

Combined review head 04f1c3bd includes the Coordinator-authorized dev merge after T-717, the fake cland merge-queue checkout fixture fix (12/12), and the approved narrow other-stack occasion fetch-proof correction. Real runner-absent stage test reproduced missing-proof rejection then passes executing all four configured tiers without cland load/coverage fields. A-6679 retains original 196/196 targeted outputs, local native C3/C5 proofs and new red-green control; hub typecheck and test lint pass. C5 files exactly match merged dev. Source review requested before a new exact-head mode-free verify.

### rev-30 · 2026-10-19T20:50:56.468Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-per-tier-occasion-integration-source
commit: 04f1c3bd3c9391262c22013a0ab498aa4992eead
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Combined delta source clear, A-6684. Direct Coordinator history authorizes owned merge-queue fixture correction, one T-717 integration and narrow other-stack occasion fetch proof. Nine owned patches identical; all C5 files byte-identical to merged dev. Resolutions retain per-tier wrappers/coverage append, paired command records/phase summaries and cland-only planning guards. Other-stack occasion performs real bounded origin/dev fetch and retains proof through admission without cland load/coverage fields. Original merge-queue assertions retained; real runner-absent task/stage controls cover composition. A-6679 main captures 196/196 plus focused stage red→green; C3/C5 remain qualified local native evidence. C1–C5 final settlement requires fresh exact-head mode-free overall green; prior red A-6654 remains historical. QA none; no Reviewer execution.

### rev-30 · 2026-10-19T21:05:24.760Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-667-per-tier-occasion-runtime
commit: 04f1c3bd3c9391262c22013a0ab498aa4992eead
scope: evidence
findings: [{"severity":"medium","text":"Exact-head A-6703 exits1: three selection/report controls expect hub/nvim-specific modes but receive project-full/empty deciding files; cache-recovery at line30 also gets the cland-phase refusal. All four ordinary cases and every repetition fail (four0/5 groups). Gate cannot settle until lead/Coordinator classification and correction/disposition; no flake/shared label inferred.","file":"hub/test/suite-selection-component.test.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6705 independently audits A-6703/be1036f7: ordinary1628/1632, four failures and20 repeated failures;272/276 groups5/5, four0/5, zero tier/resource mismatch. Source A-6684 remains the reviewed basis, but final C1–C5 withheld on red gate. Local native proofs A-6679 remain qualified only. Keep head/failed receipt; lead/Coordinator disposition required before diagnosis, shared scope change or retry, and changed head needs source review. No Reviewer tests/reruns; QA none.

### impl-667 · 2026-10-19T21:11:41.455Z

Pushed aba5deab: the single shared suite-component-fixture initializer now calls verificationFixture with identical true scripts; no production change or assertion edits. Focused cache-recovery2/3→3/3 and selection-component0/3→3/3. Coordinator-requested full serial suite-*, verify-* and merge-queue families plus suite.test.ts pass all60 files /442 tests, zero fail/cancel/skip/TODO; original outputs and focused red-green retained A-6708. Typecheck and lint pass; fetched merge-tree preflight clean. Fresh delta review requested before new mode-free verification; A-6703 retained as prior-head red.

### rev-30 · 2026-10-19T21:12:51.022Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-component-initializer-source
commit: aba5deabaf78aff471b96db48b6252fcf39abff2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fixture delta source clear, A-6711. One-file canonical verificationFixture call preserves package true scripts and materializes the cland marker, matching injected candidate facts without changing production detection/any assertion. Direct Coordinator history approves shared initializer correction. Independent A-6708 audit matches all60 requested files exactly:442/442, zero fail/cancel/skip/TODO; separate cache2/3→3/3 and selection0/3→3/3 red/green retained. Real runner-absent shell/task-batch/stage controls and all unchanged C5 files pass as qualified local native evidence. Prior integration A-6684 unchanged. C1–C5 final gate pending fresh exact-head mode-free overall green; A-6703 remains historical red. QA none; no Reviewer tests.

### rev-30 · 2026-10-19T21:28:12.303Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-667-shared-fixture-final
commit: aba5deabaf78aff471b96db48b6252fcf39abff2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6727. Independent A-6726 audit: 1894/1894, zero fail/cancel/skip/TODO, all 303 load groups 5/5, zero tier/resource mismatch or owned overrun. C1/C2 submission/CLI controls ordinary+five pass (max .277455125 s); four C4 summary controls ordinary+five pass. All four prior A-6703 failures now ordinary+five pass after canonical initializer A-6711. Retained current-source A-6708 local sweep 442/442 includes native C3 shell green/cache/red, real other-stack stage/Python tiers and unchanged C5 files; integration A-6684 applies. All C1–C5 verified. Prior red receipts retained; no Linux T3 task claim. Covered report-only rows per Coordinator; QA none; no Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-19T21:32:45.524Z

Merged 623024a71a31b50aefdd2db8bbd9e6ec0e32b661 onto dev.
