---
id: T-810
kind: task
title: "worktree-cli.test.ts hangs intermittently: four full runs today stalled with it as the last started file"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-515
branch: t/T-810-worktree-cli-test-ts-hangs
created: 2026-10-18T16:14:16.762Z
updated: 2026-10-18T18:05:03.349Z
---

## Summary

Four full runs today ended in a machine-phase stall or a 75 min timeout with hub/test/worktree-cli.test.ts as the last file started: T-759 7efa2911 (A-5076), T-709 2119e998 (A-5221) and T-645 2b7bf0f0 (A-5301), all on droplets, and E-678's macOS stage run b50559f3 (A-5411, "stalled: no output for 10 min", the last starts being all four worktree-cli cases). The file runs last in the alphabetical machine order, so earlier this looked like run order. But b50559f3's stall detector shows nothing completing for 10 min after its four cases started, which points at the file itself. Its cases start a parent hub and child projects, stop through stale discovery and select hubs by CLAND_HUB_FILE. A wait on a hub that never answers, or a stop that never returns, would hang without a deadline.

## Acceptance criteria

- [x] C1. The hanging case and its cause are named, from a reproduction (loop the file 50× on macOS and Linux) or from T-799's hung-test receipt.
  - done: impl-810 · 2026-10-18T16:45:04.062Z
  - verified: rev-31 [reviewer] · run rev-20261018-810-final · 2026-10-18T18:05:02.628Z · commit b01bae4fd3c1532a5119cd999544e9ea86d43be6
- [x] C2. Every wait in the file has a bounded deadline that fails naming the case, the cause is fixed with every assertion kept, and the file passes 50/50 serially on macOS plus a green droplet verify on Linux.
  - done: impl-810 · 2026-10-18T18:04:41.133Z
  - verified: rev-31 [reviewer] · run rev-20261018-810-final · 2026-10-18T18:05:02.629Z · commit b01bae4fd3c1532a5119cd999544e9ea86d43be6

## Comments

### impl-810 · 2026-10-18T16:18:19.711Z

Baseline reproduction underway: 16 serial macOS passes under an external 180 s hard watchdog. No confirmed hang. T-799 lead reports no historical active-case/await evidence; A-5411 has declaration-ordered starts too. Coordinator decision cad64964 accepts C1 as not reproduced in 50 macOS runs if all stay green, with original attribution explicitly open; C2 will deliver named case/operation deadlines plus 50/50 fixed runs and a green Linux droplet verify.

### impl-810 · 2026-10-18T16:33:23.423Z

Cause found during serial baseline attempts 45/46: first routing case completed body in ~2 s then waited ~120 s in hub teardown. startFreshnessDaemon used bare serveProject without isolated env, inheriting the real provider token and global executor ledger; startup sweep(true) contended on shared state, and Dispatcher.close awaits that startup recovery. Coordinator confirmed concurrent serving-hub/verification ledger contention (T-813), then ordered loop stop. Controller/runner/worker pids 54592, 94843, 94844 were killed and observed gone; 46 baseline attempts completed, attempt 47 interrupted by instruction. Fix replaces routing fixture with projectHub, adds named operation/teardown deadlines, and sanitizes shared worker/CLI executor env. Hostile inherited-token/state regression red before startup then green. 50 patched macOS attempts underway; verify held by Coordinator.

### rev-31 · 2026-10-18T16:47:07.761Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-810-source-1
commit: e80ad23a0ed925de04d626db0d1b3b1984027b45
scope: full
findings: [{"severity":"medium","text":"Promise.race deadlines abandon active startup/teardown without cancellation or drain; late ownership can register after directory cleanup. Preserve ownership and join cleanup before removal, with held-startup/teardown failure controls.","file":"hub/test/worktree-cli.test.ts","line":25}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-810 source review

Head: e80ad23a0ed925de04d626db0d1b3b1984027b45
Fixed base: b91457de (pre-review dev merge). Scope: full; four test/fixture files.

Standards: not clear.
M1 (medium), hub/test/worktree-cli.test.ts:25: caseDeadlines.wait only races the operation against a timer; it neither cancels nor drains it. A projectHub startup held in serveProject/log flush can complete after the timeout and register beforeDirectories after the shared cleanup hook already removed its root. The proxied teardown hook similarly returns a deadline failure while the original cleanup remains active. This loses lifecycle ownership on the very failure path being bounded. Retain ownership before starting, cancel/drain timed-out startup/operations, and ensure fixture writers and cleanup complete before removal. Controlled held-startup and held-teardown tests must observe cleanup order, beyond the current never-resolving promise probes. Implementer confirmed the missing guarantee in 782d94ab-3b23-48c9-8930-bea4d71b739e and will request a replacement source review.

Spec: C2 not clear for the same lifecycle gap. The nominal operation labels and native Git timeout cover the visible awaits; the isolated projectHub/default CLI executor state and cleared worker provider token address the observed unsafe inheritance. Existing explicit fake-provider overrides remain last in the environment. The diff preserves the behavioral assertions; the recorded AST audit reports 32/32 identical assertions after removing deadline wrappers. A-5451 retains baseline attempts 45/46 around 120-second first-case teardown and 50/50 fixed macOS whole-file receipts, plus named deadline failures. Those probes establish failure reporting, not cancellation/drain safety.

Coordinator f6031d10/f3dccdaa/7e7adb7c were independently read: reproduction was accepted and unsafe inherited provider/global ledger access was ordered fixed. Historical attribution of all four older interrupted suites remains open; this review does not claim they share the reproduced case. C1 remains unverified in this pass; C2 failed. No verification at this head; revised source must be reviewed first. No per-item QA required.

Evidence: A-5455.

Criteria: C2 failed (Deadline rejection does not cancel/drain active startup or teardown, permitting late ownership after fixture cleanup.).

### impl-810 · 2026-10-18T16:58:47.910Z

M1/C2 revised at cc5439ee (pushed), replacement source review requested. A-5470 proves controlled held startup/teardown ownership with real projectHub writers and FakeClock, red mutant sensitivity, and stop-before-removal order. Worker state cleanup drains retained work and skips removal if drainage expires. Original 32 assertions unchanged. Typecheck/lint and hostile-env regression green; revised 50-run macOS loop underway. No dev merge after first review and no verification submitted on rejected e80ad23a.

### rev-31 · 2026-10-18T17:00:09.219Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-810-source-2
commit: cc5439eeeff37c4bb2bcf8b97cd22d2deaa8fd1f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-810 replacement source review

Head: cc5439eeeff37c4bb2bcf8b97cd22d2deaa8fd1f
Scope: full follow-up to rev-20261018-810-source-1. Parent e80ad23a; no post-review dev merge.

Standards: clear. case-deadlines registers its single fixture owner synchronously, tracks work before invoking its callback, and drains in-flight operations before queued cleanup hooks. A named failure deadline no longer discards ownership: original startup/teardown promises remain in the worker retention set until settlement. Account/state cleanup awaits retained work and skips removal if its own bounded drain fails. Permanently uncooperative work is explicitly left for runner recovery, not claimed cancelled. The case retains its original T3 lifecycle seam; new held-lifecycle proofs use real in-process projectHub writers and FakeClock at T2, declared in tiers.json.

Spec: clear. M1/C2 is addressed: late startup can register shutdown ownership before directory cleanup, and timed-out teardown retains its original completion boundary. A-5470's two raw negative mutants fail on startup directory-race ENOTEMPTY and premature worker drainage; the restored implementation passes both tests (2/2,1.078s), positively observing shutdown while the root exists and removal afterwards. The hostile-environment guard also passes. Worker/CLI token and executor isolation from the initial change remains, and all 32 original assertions are retained. A-5451's reproduced ~120-second first-case teardown and Coordinator instructions remain the cause evidence; historical attribution of four older full-run stalls remains open.

Findings: none. C1/C2 remain unverified pending completion/audit of the replacement-head macOS 50/50 proof and exact-head Linux task receipt. The initial 50/50 proof is for e80ad23a and is not substituted for the current run, which was 17/50 at request time. Source clearance permits the single mode-free droplet run only after the revised macOS requirement completes. No per-item QA; no source/head change before the run without fresh review.

Evidence: A-5471.

### rev-31 · 2026-10-18T17:36:00.837Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-810-runtime-1
commit: cc5439eeeff37c4bb2bcf8b97cd22d2deaa8fd1f
scope: evidence
findings: [{"severity":"medium","text":"New case-deadlines.ts dependency is missing from suite-coverage.test.ts's partial fixture copy, producing ERR_MODULE_NOT_FOUND in exact-head Linux run. Update/audit carriers without weakening coverage assertions.","file":"hub/test/account-fixture-env.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-810 first runtime review

Head: cc5439eeeff37c4bb2bcf8b97cd22d2deaa8fd1f, matches source-2.
Scope: evidence. Run224ae741-7843-422b-b60b-9fd2f36f082c / A-5497, raw exit1.

M1 (medium), hub/test/account-fixture-env.ts:10: new case-deadlines.ts import is absent from the partial package copied by suite-coverage.test.ts. A-5497:49636 reports ERR_MODULE_NOT_FOUND importing copied hub/test/case-deadlines.ts from copied account-fixture-env.ts; the fixture's explicit dependency list omits the new module. This is task-owned carrier fallout. Add the dependency and audit other partial copies, retain all coverage assertions, and obtain a revised source verdict before another run.

All four worktree cases positively pass on Linux (1.427086,1.275951,3.104972,4.430334s). Both held-lifecycle cases pass (0.088631,0.042377s) and5/5 load gates each. There are no owned runtime tier trips. A-5472 has independently audited50/50 current-head macOS raw files, all four cases each and zero failures/cancellations/skips; all seven recorded source hashes match the reviewed commit. Those positives do not turn this failed task run green.

Ordinary run2258 tests:2252 pass,1 fail,0 cancelled,5 skips. Hub free284/284; machine1968 pass,1 fail,5 skips. Neovim did not run. The interruption total includes repetitions and is not the ordinary total. Linux x64 c-8lon1,workers2,Node24.21.0/Neovim0.12.5; lifetime1370s,cost$0.0952,peak load7.96.

C2 failed because the required green droplet verification is absent. C1 remains unverified in this pass; original reproduced cause evidence remains available. Findings:one medium. No same-head retry is authorized by this review; fix/corrected source review first.

Review evidence: A-5498.

Criteria: C2 failed (Exact-head Linux run exits1 because coverage fixture omits the new case-deadlines.ts helper; required green verification is absent.).

### impl-810 · 2026-10-18T17:38:11.687Z

Linux A-5497 failure was owned carrier fallout (missing case-deadlines.ts in the explicit suite-coverage fixture copy list), fixed at pushed b01bae4f. A-5499 records exact local red/green, all coverage assertions retained, partial-copy audit and unchanged seven source hashes from Mac50 receipt A-5472. Existing suite-coverage file now passes both tests in 2.973 s; typecheck/lint green. Fresh source review requested; no replacement verification yet.

### rev-31 · 2026-10-18T17:39:06.392Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-810-source-3
commit: b01bae4fd3c1532a5119cd999544e9ea86d43be6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-810 source review after carrier repair

Head: b01bae4fd3c1532a5119cd999544e9ea86d43be6
Scope: full corrected-source follow-up; parent source-2 cc5439ee, no dev merge.

Standards: clear. The only delta adds case-deadlines.ts to suite-coverage.test.ts's explicit copied dependency list. The module's own clock dependency is already carried in the full hub/src copy. No test assertions, runtime sources, isolation behavior, deadlines or ownership logic change.

Spec: clear. The Linux ERR_MODULE_NOT_FOUND from A-5497/A-5498 is addressed directly. A-5499's existing coverage test reproduces the missing-module red then positively passes both tests after repair (2/2,2.973s); real descendant coverage and malformed/I/O receipt assertions remain intact. The copy audit identifies this as the sole partial account-fixture/harness carrier; prepared-project copies the full tree and compiler fixtures do not import these modules. Independent search finds the same explicit carrier boundary.

All seven SHA-256 values recorded in A-5472 independently match this head, so the already audited50/50 serial Mac files remain applicable to unchanged worktree/isolation/ownership inputs. The earlier Linux positives for four worktree cases and both held-lifecycle5/5 gates remain partial evidence only: A-5497 is still raw red and lacks Neovim completion.

Findings:none. C1/C2 remain unverified pending a replacement green exact-head droplet result; no repeated Mac run is needed for the unchanged seven inputs. Source clearance permits one replacement mode-free task verification at this head. No per-item QA; freeze the head until its result or a new review request.

Evidence: A-5500.

### rev-31 · 2026-10-18T18:05:02.629Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-810-final
commit: b01bae4fd3c1532a5119cd999544e9ea86d43be6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-810 final evidence review

Head:b01bae4fd3c1532a5119cd999544e9ea86d43be6; unchanged source-3/pushed tip.
Scope:evidence. Replacement run812e49d0-0c0e-4a21-9aca-74e1f1761c22 / A-5505, full exit0. C2 done restored by claimant cbcc6bdd.

All four original worktree cases positively pass on Linux (1.380735,1.099498,2.977005,4.113131s), and both held ownership cases pass (0.071306,0.038907s) with5/5 gates each. The formerly broken real-process coverage carrier now passes3.880659s, preserving descendant attribution/malformed-I/O receipt assertions. No owned runtime tier trips, budget failures or quarantine entries.

A-5472's50 raw serial Mac whole-file logs were independently audited:200/200 case passes,zero failures/cancellations/skips,7.167–10.359s/file. All seven recorded source hashes match current b01bae4f; its only change since those receipts is the reviewed coverage-carrier dependency. A-5470 provides sensitive held-startup/teardown red mutants and green cleanup-order proof. A-5451 names the reproduced first-case ~120s teardown and unsafe inherited provider/global ledger path; Coordinator f6031d10/f3dccdaa/7e7adb7c independently confirmed acceptance and required isolation. Historical attribution of all four earlier full-run interruptions remains open, and no50-run Linux reproduction is claimed. The required fixed Linux task verification is green.

Full2633 ordinary tests:2625pass,0fail,0cancelled,8 platform/binary-availability skips. Hub free284/284; machine1969pass+5skip; Neovim372pass+3skip,166.95s. All three failure arrays empty. Four inherited report-only tier trips remain in unchanged init-next/suite-close-component paths; no global-zero claim. Linux x64 c-8lon1,workers2,Node24.21.0/Neovim0.12.5; lifetime1455s,cost$0.1011,peakload5.99.

Findings:none. C1/C2 verified from source, accepted reproduction, current-source Mac repetition and exact-head green Linux evidence. No further task run or per-item QA required.

Review evidence:A-5506.

Criteria: C1 verified, C2 verified.
