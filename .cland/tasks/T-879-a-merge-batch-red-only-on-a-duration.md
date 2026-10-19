---
id: T-879
kind: task
title: A merge batch red only on a duration budget is held as inconclusive instead of refusing the member that added the over-budget test
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-605
branch: t/T-879-a-merge-batch-red-only-on-a-duration
created: 2026-10-19T15:02:34.299Z
updated: 2026-10-19T15:38:26.560Z
---

## Summary

A merge batch that fails only on a duration budget (no failing test) is held as "inconclusive: no failing-test receipt", and no member is identified. Batch 2d463ace (T-847, T-666, T-841; A-6124) failed on `duration budget: hub/test/suite-recovery.test.ts::hub restart preserves the submitted command lines while its worker finishes 5.036 s > 5 s`, a test added by T-666. The Coordinator recovered it by hand.

## Acceptance criteria

- [x] C1. A batch red only on duration budgets refuses the member whose diff adds or changes the over-budget identity (or rerun-checks the identity like a failing file), naming the budget line. It is not held as inconclusive. A component test drives a budget-only red batch with two members.
  - done: impl-879 · 2026-10-19T15:05:27.191Z
  - verified: rev-31 [reviewer] · run rev-20261019-879-final · 2026-10-19T15:38:25.973Z · commit 44a8270ef58fbde00db2a85c2a86664e1e6a9f9f

## Comments

### coord · 2026-10-19T15:03:18.495Z

Root cause of the trap, from impl-666 (2026-10-19 15:03Z): durations.json has no budget.mode, so the runner is in report mode. checkDurations's report branch still applies the legacy new-identity gate: budget.testSeconds = 5 s for any identity with neither a baseline nor an allowance, whatever its tier. A new T3 test over 5 s therefore turns the merge batch red, and the task verify never sees it, because T3 runs only in the batch. Scope for T-879: either refuse the member that added the identity (as in C1), or flag new T3 identities missing a baseline before enqueue. Also state whether the 5 s legacy gate should use the identity's tier limit instead.

### impl-879 · 2026-10-19T15:04:38.130Z

Regression-first evidence: `node --test --test-name-pattern='budget-only red pair' hub/test/merge-batches.test.ts` failed with `original … inconclusive: no failing-test receipt` before implementation, then passed after routing measured duration-budget identities through the existing leave-one-out file reruns. Component seam composes real MergeBatches and Suites with planted executor receipts (existing file tier T1; no process/socket needed). Report-mode 5 s gate remains unchanged: documented report/enforce rollout reserves tier-specific enforced limits for enforce mode; this fix attributes the existing gate rather than silently changing policy.

### rev-31 · 2026-10-19T15:06:50.662Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-879-source
commit: 44a8270ef58fbde00db2a85c2a86664e1e6a9f9f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6132 records Standards/Spec audit, no findings. Parser recognizes actual measured test/file duration-budget failures, retains exact full lines and merges file-addressable identities into existing leave-one-out diagnosis. Unique-green omission policy, candidate head/tree checks and inconclusive interrupted/unknown receipt guards remain. Refusals/reports retain observed seconds/threshold. Test/file budget pair controls assert both reruns, correct file selection, exact culprit refusal and green-tree landing; missing-tier errors remain inconclusive. New cases are T1 with fake executor receipts; no policy limit, child-process or wall-wait change. A-6129 reports regression red then31/31 green with new cases about0.145s plus typecheck/lint green. C1 final execution verification remains pending same-head mode-free task gate; source clearance is not final runtime evidence.

### rev-31 · 2026-10-19T15:38:25.973Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-879-final
commit: 44a8270ef58fbde00db2a85c2a86664e1e6a9f9f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no findings. Independently audited A-6161 / 39dc7df9 at the exact source-cleared head: all 1560 ordinary finishes pass and all 480 gates pass 5/5. The 31 owned tests pass, with 155 passing repetitions. Both new test-budget-only and file-budget-only attribution controls pass ordinarily (0.115408562 s / 0.100500649 s) and 5/5, proving unique member refusal with budget-line provenance. Owned body sum 1.955522857 s; ordinary/repetition maxima 0.298281123 / 0.337050805 s; no owned budget or resource trip. C1 verified. Full external diagnostics retained in the final evidence artifact posted in topic-605: 21 report-only budgets plus four known T-856 onboarding resource trips (T-877 overlap), with roles-editor budget overlapping T-875. Native T3 remains the merge-batch gate.

Criteria: C1 verified.
