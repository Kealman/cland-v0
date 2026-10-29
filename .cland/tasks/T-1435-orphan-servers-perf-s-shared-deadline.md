---
id: T-1435
kind: task
title: orphan-servers-perf's shared-deadline case misses its expected rejection once in a full macOS cover
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1207
branch: t/T-1435-orphan-servers-perf-s-shared-deadline
created: 2026-10-28T21:37:03.480Z
updated: 2026-10-29T18:53:28.941Z
closed: 2026-10-29T18:53:28.941Z
---

## Summary

`hub/test/orphan-servers-perf.test.ts` "the shared sweep deadline preserves remaining servers and prevents later signals" (T4) failed once in the E-1311 stage-3 / E-1312 stage-2 macOS cover e4f27594 at adf3140c (A-13475): "AssertionError: Missing expected rejection" at line 27. The sweep with a 400 ms deadline resolved instead of rejecting with /deadline|failed|timed out/. It passed 5/5 alone right after (coord, 2026-10-28 21:40Z). The file's own header says its elapsed-time assertions need a quiet machine; it ran at the end of a full macOS cover (T4 phase, peak load 5.03).

## Acceptance criteria

- [x] C1. The test proves the deadline independently of host speed: it holds the TERM-resistant server alive through the deadline by a mechanism the test owns, rather than relying on the sweep taking longer than 400 ms of wall time, with 10/10 under two workers plus CPU load on macOS.
  - done: impl-1435 · 2026-10-29T18:17:53.186Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1435-final · 2026-10-29T18:44:56.278Z · commit 0fe36e7c4b40ee06299a797be41452d60f34b667

## Notes

First sighting; load flake under the flaky-rerun rule (one cover resubmit).

## Comments

### impl-1435 · 2026-10-29T18:14:45.659Z

Scope/seam: retain native sweepOrphans process-lifecycle regression. No production, wire, schema or shared policy change. Plan to stop the owned native fixture, verify its stopped OS state, freeze Date at the sweep boundary, and expire that clock only when the sweep sends its first TERM. This keeps discovery outside the deadline race and makes deadline rejection independent of scheduler speed; actual OS signals remain observable. Awaiting Coordinator's separate exclusive stress slot.

### rev-34 · 2026-10-29T18:25:15.184Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1435-source1
commit: cd764c73a06ed7ae0de4f479cce16358819512f1
scope: full
findings: [{"severity":"medium","text":"M1: the new guide has a descriptive H1 and no Notes index membership; the unchanged test-docs guard rejects it. Correct the owned heading/index metadata and obtain successor source clearance.","file":"docs/agents/tests/hub-test-orphan-servers-perf.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13937 records the consolidated Standards/Spec audit and original macOS stress limits. No independent Spec finding. Reported documentation successor is outside this fixed-head verdict; C1 runtime remains unverified pending corrected-head source and configured evidence.

### rev-34 · 2026-10-29T18:25:40.364Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1435-source2
commit: 0fe36e7c4b40ee06299a797be41452d60f34b667
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13939: Exact H1 and Notes index membership resolve sole M1. Native test/stress source unchanged from A-13937; no dev merge. Standards/Spec clear; runtime C1 remains unverified pending exact-head configured evidence.

### rev-34 · 2026-10-29T18:44:56.278Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1435-final
commit: 0fe36e7c4b40ee06299a797be41452d60f34b667
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13980: Original A-13977 confirms 4194 ordinary passes and both T4 native cases, one base/no repetitions. Deadline case 2.491502961 s; separate macOS 10/10 two-lane CPU proof/capture limits preserved, native test source identical across docs successor. C1 verified. Host reuse, report-only warnings and remaining unrun coverage retained. Coordinator owns integration/enqueue.

Criteria: C1 verified.

### coord · 2026-10-29T18:53:28.941Z

Merged 483f4177e657cebcff1b7142362ca633e148317c onto dev.
