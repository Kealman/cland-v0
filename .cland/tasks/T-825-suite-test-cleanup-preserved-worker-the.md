---
id: T-825
kind: task
title: "suite.test cleanup-preserved worker: the finished frame can arrive before the job row holds the cleanup error"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-813
topic: topic-548
branch: t/T-825-suite-test-cleanup-preserved-worker-the
created: 2026-10-19T03:23:55.419Z
updated: 2026-10-19T04:46:29.432Z
closed: 2026-10-19T04:46:29.432Z
---

## Summary

`hub/test/suite.test.ts` › "failure cleanup preserves a live worker whose recorded start identity is unavailable" failed once in cover 20644fd3 at 5ecddbd2 (shard-2, A-5743, line 49198). After the restarted hub's `verify finished` task frame, the cleanup error read from the per-job meta row `suite-job:<id>` was empty, while the test expected "suite cleanup waiting for a verified worker identity; process preserved". It passed 5/5 alone on macOS. Most likely the finished frame is published before the per-job row, the storage T-813 introduced, holds the cleanup error. Related to T-445 (closed), which fixed an earlier timeout in the same test.

## Acceptance criteria

- [x] C1. The finished task frame for a cleanup-preserved job is published only after its persisted record carries the cleanup error, or the test waits on the persisted error itself; a red-to-green proof delays the row write. All assertions are kept.
  - done: impl-825 · 2026-10-19T03:30:06.419Z
  - verified: rev-30 [reviewer] · run rev-20261019-825-final · 2026-10-19T04:01:41.790Z · commit 4977503f060d7fe9ca6263ac36c903a079da9b44
- [x] C2. The file passes 20 serial runs on macOS, and suite.test.ts passes in a Linux droplet run at the reviewed head (the task run when it includes T3, as before T-713 went live) or in the first integrated Linux cover that includes this merge.
  - done: impl-825 · 2026-10-19T04:01:12.345Z
  - verified: rev-30 [reviewer] · run rev-20261019-825-final · 2026-10-19T04:01:41.791Z · commit 4977503f060d7fe9ca6263ac36c903a079da9b44

## Comments

### impl-825 · 2026-10-19T03:25:44.911Z

A-5743 line 49198 confirmed the empty cleanup error after a finished task frame. Deterministic T1 reproduction pauses LocalExecutor.release before its cleanup-error checkpoint: latest() returns finished while the persisted error is still absent. Red: node --test --test-name-pattern='cleanup-blocked terminal' hub/test/suite-persistence.test.ts; actual finished, expected running. Cause: latest item/branch maps alias mutable SuiteJob; unrelated tracker frames bypass #remember's publication guard. Fixing lookup snapshots at publishable persisted checkpoints; retaining all suite.test assertions.

### rev-30 · 2026-10-19T03:34:48.329Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-825-source
commit: 4977503f060d7fe9ca6263ac36c903a079da9b44
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings on either axis. A-5752 records the eligibility-before-lookup fix, snapshot/transaction ordering and T1 held-cleanup regression with independent Store read. Original suite.test assertions unchanged. Raw A-5751 confirms 20/20 serial Mac runs, 220 passed cases including all 20 preserved-worker cases. C1/C2 remain unverified pending required runtime evidence. Per Coordinator c5b6751d, C2 also requires the first integrated Linux suite.test receipt after merge; the upcoming mode-free T0–T2 task gate is not that deferred T3 proof. QA scope none.

### rev-30 · 2026-10-19T04:01:41.791Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-825-final
commit: 4977503f060d7fe9ca6263ac36c903a079da9b44
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear from source A-5752, raw audit A-5764 and Coordinator C2 settlement A-5765. Explicit cd3a5f35 and task.view revision accept the actual same-head Linux T3 execution: suite.test 11/11 including preserved worker, alongside 20/20 serial Mac runs A-5751. Accepted task gate d36a7b8c/A-5763 has 2399 pass, 5 skip, zero fail/cancel; held-cleanup regression passes ordinarily and 5/5, persistence 4/4. C2-pending text in A-5764 is superseded by the revised criterion; no inferred integrated proof. No findings; C1/C2 verified; known report-only diagnostics retained. QA scope none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T04:46:29.432Z

Merged 55a9bbfb601632246046b2c941395710577253af onto dev.
