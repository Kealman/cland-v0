---
id: T-519
kind: task
title: Sharded runs leak CLAND_SUITE_SELECTION into nested runner tests, so suite-runner.test.ts:768 fails in every stage close
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-387
blocked_by: []
regression_of: T-395
topic: topic-313
branch: t/T-519-sharded-runs-leak-cland-suite-selection
created: 2026-10-15T18:11:26.752Z
updated: 2026-10-15T19:27:35.402Z
closed: 2026-10-15T19:27:35.402Z
---

## Summary

Every sharded integrated run fails `hub/test/suite-runner.test.ts:768`, the two "sharded package runs keep a recovery record…" cases. The shard exports `CLAND_SUITE_SELECTION` (hub/src/executor/droplet/run.ts:55; hub/src/hub/suite-worker.ts:74). The test spawns a nested `runPackageSuite` with `env: { ...process.env }`, so the nested runner reads the outer shard's file list and throws `unknown explicit hub shard file: hub/test/account-limited.test.ts` (hub/src/suite-shards.ts:81). Seen in E-387's stage-1 close run 1bebcda2 at 9bc15ce8 (A-3232). It doesn't fail in unsharded runs, which is why T-395's own receipts missed it.

## Acceptance criteria

- [x] C1. The package runner consumes `CLAND_SUITE_SELECTION` and removes it before it spawns test processes, so no test or nested runner inherits a shard selection. Alternatively, nested-runner tests strip it explicitly, and the commit says which and why.
  - done: impl-519 · 2026-10-15T18:14:11.473Z
  - verified: rev-31 [reviewer] · run rev-20261015-519-source · 2026-10-15T18:16:16.834Z · commit 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96
  - verified: rev-31 [reviewer] · run rev-20261015-519-merge-delta · 2026-10-15T19:26:56.855Z · commit 9535da1733021954582ff83607a388001b3e5fd7
- [x] C2. A test sets CLAND_SUITE_SELECTION in its own environment and shows suite-runner.test.ts's nested-runner cases still pass, plus a same-head verify; the next real sharded stage run being green on this file is judged at E-387's stage-1 close by the Coordinator (amendment 2026-10-15 18:15Z).
  - done: impl-519 · 2026-10-15T18:14:16.814Z
  - verified: rev-31 [reviewer] · run rev-20261015-519-final · 2026-10-15T19:17:02.758Z · commit 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96
  - verified: rev-31 [reviewer] · run rev-20261015-519-merge-delta · 2026-10-15T19:26:56.855Z · commit 9535da1733021954582ff83607a388001b3e5fd7

## Comments

### impl-519 · 2026-10-15T18:13:09.157Z

Regression seam: the existing package-runner subprocess interface. The new test supplies an explicit outer shard, excludes unassigned hub/Neovim files, and executes a nested package fixture with distinct test names and both package phases. No test process should inherit CLAND_SUITE_SELECTION.

### rev-31 · 2026-10-15T18:16:16.834Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-519-source
commit: 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96
scope: full

Source review clear at 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96. No high, medium or low findings.

## Standards
No documented-standard or actionable baseline-smell findings. The fix is at the runner's child-environment boundary, alongside existing child-only environment removals, and adds one public subprocess regression. Diff check passes; no unrelated source changes.

## Spec
C1 verified at hub/test/run-suite.ts:96-98: copy the current environment for each spawned phase, then delete CLAND_SUITE_SELECTION from that copy. The outer runner has already parsed selection into a local SuiteSelection, uses it to build packageShards/phase targets and passes it to reporting; the fix does not mutate process.env or discard the outer shard assignment. Every spawned test phase uses the sanitized copy.
The commit explains that nested runners otherwise interpret outer shard paths relative to unrelated fixture roots.

Regression hub/test/suite-runner.test.ts:768-800 supplies an explicit outer shard selecting only one hub file and no Neovim. Unassigned outer files throw if executed. The selected test invokes a distinct nested package fixture; nested hub and Neovim tests assert absent selection and append ordered completion receipts. Exit zero plus both receipt paths proves the selected outer test and both nested phases ran.
A-3239 checked: exact unknown explicit hub shard file failure before the fix. A-3240 checked: regression plus both existing sharded recovery-record cases pass 3/3. A-3242 checked: whole suite-runner file 51/51, no failures/skips/cancellations, 68.13 s wall; typecheck green reported.

C2 regression portion is established; C2 remains unverified pending the same-head verify. Coordinator 94e7f8dc-e7a2-48c2-84a9-5b3a41face56 and amended task criteria explicitly place the real sharded stage check at the post-merge E-387 stage-1 close, not this task gate. After this source clear the requested fresh droplet verify may proceed at this exact head.
Standards: 0 findings. Spec: 0 findings. No Reviewer tests or edits.

Criteria: C1 verified.

### impl-519 · 2026-10-15T18:48:53.967Z

First exact-head fresh droplet receipt f7d9802a / A-3267 at 72ad0a44: 1783 pass, 1 failure only on known E-482/T-502 (suite-close-recovery lost-machine injection races successful completion). New explicit-shard regression and both original sharded recovery-record cases pass. Submitted one more unchanged-head droplet under the known-flake gate; no source changes.

### rev-31 · 2026-10-15T18:50:35.400Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-519-linux-1
commit: 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96
scope: evidence

Evidence review at 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96, run rev-20261015-519-linux-1.

Result: not clear; no new source findings. C1 remains verified by source review; C2 awaits an accepted same-head gate.

Medium — hub/test/suite-close-recovery.test.ts:54: A-3267/f7d9802a exits 1 because the lost-machine case expects /shard-1: remote machine lost/ but receives a successful two-shard result before injected loss is observed. This matches the existing T-502 failure; no new item is needed.

A-3267 independently checked: Linux droplet, exact reviewed head, 1787 tests / 1783 pass / 1 fail / 3 skip / 0 cancelled. New nested-runner regression passes in 2.2479 s; both existing sharded recovery-record cases pass in 1.747 and 1.7868 s. No hard duration-budget failures. Hub exits before Neovim, so this receipt does not establish that phase.

The source verdict remains unchanged. Retry 99ad4f31-4025-4110-86c3-ff3e12c52a7d has been admitted at the same head. A green run or explicitly accepted known-flake gate is required for final clearance. Post-merge real sharded stage remains E-387 stage-1 scope per Coordinator 94e7f8dc-e7a2-48c2-84a9-5b3a41face56.

Review artifact A-3269: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3269-t-519-first-linux-evidence-known-t-502-blocks-final-gate.md
No criterion failed: the observed external failure is already T-502; C2 is pending accepted gate evidence.

### rev-31 · 2026-10-15T19:16:21.477Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-519-linux-2
commit: 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96
scope: evidence

Evidence review at unchanged 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96, run rev-20261015-519-linux-2. Result: not clear.

Medium — hub/test/suite-close-recovery.test.ts:54: second fresh Linux run 99ad4f31/A-3286 repeats exactly the sole T-502 lost-machine assertion from f7d9802a/A-3267: expected /shard-1: remote machine lost/, actual all exit 0 with both shards successful. The known-flake two-receipt rule requires different failures, so this repeated failure needs Coordinator disposition.

A-3286 checked: 1787 tests, 1783 pass, 1 fail, 3 skip, zero cancelled; final exit 1. Changed explicit-shard regression passes at 2.0674 s; existing standalone and old V1 recovery-record cases pass at 1.7971 s and 1.7704 s (log lines 3146-3156). Hub stops before Neovim. No new source findings and no hard duration-budget failures; source/head unchanged.

C1 remains verified by rev-20261015-519-source. C2 remains pending an accepted gate; no behavioral criterion failed because the external defect is already T-502. Both receipts stop before the full Neovim phase. No third run or source change requested; await Coordinator decision or a posted shared fix. Real sharded-stage validation stays at post-merge E-387 stage-1 close per amendment 94e7f8dc-e7a2-48c2-84a9-5b3a41face56.
Review artifact A-3287: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3287-t-519-second-linux-evidence-repeated-t-502-gate-failure.md

### rev-31 · 2026-10-15T19:17:02.758Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-519-final
commit: 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96
scope: evidence

Final evidence review clear at 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96, run rev-20261015-519-final, scope evidence.

No high or medium findings remain in T-519's source. C1 verification from rev-20261015-519-source remains current. C2 verified from the explicit outer-selection subprocess regression, whole-file evidence and Coordinator-accepted exact-head gate.

Evidence:
- A-3239 proves the regression fails before the fix with unknown explicit hub shard file; A-3240 has the changed regression plus both existing sharded recovery-record cases passing; A-3242 has the whole suite-runner file passing 51/51.
- Linux droplet f7d9802a/A-3267 at this exact head: 1787 tests, 1783 pass, 1 fail, 3 skip, 0 cancelled; changed regression 2.2479 s, recovery cases 1.747/1.7868 s.
- Linux droplet 99ad4f31/A-3286 at this same head: 1787 tests, 1783 pass, 1 fail, 3 skip, 0 cancelled; changed regression 2.0674 s, recovery cases 1.7971/1.7704 s.
- Both receipts exit 1 solely on the existing T-502 lost-machine injection race at hub/test/suite-close-recovery.test.ts:54 (expected lost-machine report, actual successful two shards). T-519 changes neither that file nor its injection. Neither run reaches the full Neovim phase.

Coordinator decision 0061835e-f6bb-41aa-b3c0-99c00adf422a explicitly accepts A-3267 plus A-3286 as the task gate despite the repeated T-502 failure and directs final clear. This is an explicit exception, not a green-suite claim or the standard different-failure rule. T-502 is separately assigned.

Source branch remains unchanged at the reviewed SHA. The next real sharded-stage result remains Coordinator's post-merge E-387 stage-1 close responsibility per amended C2 and 94e7f8dc-e7a2-48c2-84a9-5b3a41face56. No Reviewer edits or new tests.
Review artifact A-3288: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3288-t-519-final-clear-accepted-paired-linux-evidence-at-72ad0a44.md

Criteria: C2 verified.

### rev-31 · 2026-10-15T19:26:56.855Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-519-merge-delta
commit: 9535da1733021954582ff83607a388001b3e5fd7
scope: delta

Delta review clear at merge head 9535da1733021954582ff83607a388001b3e5fd7, run rev-20261015-519-merge-delta.

Standards: no findings. Spec: no findings. C1 and C2 refreshed at this head.

Merge parents are original reviewed 72ad0a44 and origin/dev a59514ae. Full diff against the dev parent is exactly two runner lines plus the original 33-line regression, with no additional changes. At hub/test/run-suite.ts:102-105 the child environment retains both CLAND_SUITE_SELECTION removal and dev's CLAND_COVERAGE_OUTPUT removal. The parent runner reads the coverage target before phases and its parsed selection remains local; subsequent coverage capture and configured worker paths match dev unchanged. The regression at hub/test/suite-runner.test.ts:768 is unchanged; dev's additional worker assertions in the adjacent recovery-record tests are retained.

A-3295 checked in full: whole-file serial Mac passes suite-runner 51, durations-runner 4, verification-workers 4, suite-selection 83, suite-selection-report 4, suite-coverage 1, suite-close 7, suite-close-recovery 5 — 159 pass, zero failures/skips/cancellations. Changed explicit-shard regression and both original recovery cases pass. Independent identifier search for both environment keys across hub/test and nvim/test matches the covered files. Typecheck is reported passing; reviewed diff check passes.

Coordinator bfcc21e4-beee-47a6-8481-9e768aa75da8 explicitly authorized this merge, identifier-based serial cover, delta review, and retention of A-3267 plus A-3286 without a new full verify. Those exact-original-head Linux receipts remain exit 1 solely on T-502 and stop before full Neovim, accepted under 0061835e-f6bb-41aa-b3c0-99c00adf422a; they are not described as green or exact-new-head full runs. With the verified merge resolution and requested cover, final clearance carries to this head under that waiver.

Real integrated sharded-stage validation remains post-merge E-387 stage-1 close per amended C2. No Reviewer edits or test execution.
Review artifact A-3297: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3297-t-519-merge-delta-clear-at-9535da17.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-15T19:27:35.402Z

Merged 3f39865d0121dafc864b9e5a44ee62b5e223d1fb onto dev.
