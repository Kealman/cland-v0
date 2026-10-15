---
id: T-519
kind: task
title: Sharded runs leak CLAND_SUITE_SELECTION into nested runner tests, so suite-runner.test.ts:768 fails in every stage close
state: open
status: review
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
updated: 2026-10-15T18:16:16.834Z
---

## Summary

Every sharded integrated run fails `hub/test/suite-runner.test.ts:768`, the two "sharded package runs keep a recovery record…" cases. The shard exports `CLAND_SUITE_SELECTION` (hub/src/executor/droplet/run.ts:55; hub/src/hub/suite-worker.ts:74). The test spawns a nested `runPackageSuite` with `env: { ...process.env }`, so the nested runner reads the outer shard's file list and throws `unknown explicit hub shard file: hub/test/account-limited.test.ts` (hub/src/suite-shards.ts:81). Seen in E-387's stage-1 close run 1bebcda2 at 9bc15ce8 (A-3232). It doesn't fail in unsharded runs, which is why T-395's own receipts missed it.

## Acceptance criteria

- [x] C1. The package runner consumes `CLAND_SUITE_SELECTION` and removes it before it spawns test processes, so no test or nested runner inherits a shard selection. Alternatively, nested-runner tests strip it explicitly, and the commit says which and why.
  - done: impl-519 · 2026-10-15T18:14:11.473Z
  - verified: rev-31 [reviewer] · run rev-20261015-519-source · 2026-10-15T18:16:16.834Z · commit 72ad0a4480e2dc0c4c529552ad7eb94e5782bc96
- [x] C2. A test sets CLAND_SUITE_SELECTION in its own environment and shows suite-runner.test.ts's nested-runner cases still pass, plus a same-head verify; the next real sharded stage run being green on this file is judged at E-387's stage-1 close by the Coordinator (amendment 2026-10-15 18:15Z).
  - done: impl-519 · 2026-10-15T18:14:16.814Z

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
