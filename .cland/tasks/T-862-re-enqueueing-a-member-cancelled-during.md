---
id: T-862
kind: task
title: Re-enqueueing a member cancelled during a live batch loses the new entry when the batch drops the old one
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-595
branch: t/T-862-re-enqueueing-a-member-cancelled-during
created: 2026-10-19T09:55:24.388Z
updated: 2026-10-19T16:12:54.841Z
closed: 2026-10-19T16:12:54.841Z
---

## Summary

Cancelling a batch member and re-enqueueing it while the batch's run is live loses the new entry. When the run finishes, the batch refuses the old member ("queued request changed or cancelled"), and `drop` removes the item's current queue entry too, the fresh one included.

## Evidence

2026-10-19 09:34Z: the Coordinator ran `cland merge T-848 --cancel`, then `cland merge T-848` (queued 6), while batch 9913748e (T-849, T-848, T-831) was running. At 09:55Z the run finished, the hub reported `merge-queue-dropped T-848: queued request changed or cancelled`, and T-848 was gone from `cland merge queue`. Re-enqueued by hand.

## Acceptance criteria

- [x] C1. Refusing a batch member drops only the entry the batch pinned (same item, head and enqueued time); a newer entry for the same item stays queued. A component test cancels and re-enqueues a member during a live batch run and shows the new entry still queued after the batch resolves.
  - done: impl-862 · 2026-10-19T14:51:49.795Z
  - verified: rev-30 [reviewer] · run rev-20261019-862-final · 2026-10-19T15:00:23.153Z · commit dd18e84ff0f6a8a93fc7f26d3ee06ae527f6d230

## Comments

### impl-862 · 2026-10-19T14:51:12.410Z

Red regression confirmed before production changes: node --test --test-name-pattern='refusing a cancelled live batch' hub/test/merge-queue.test.ts fails (189 ms). Through projectHub merge frames, a live singleton batch is cancelled/re-enqueued at the same head with a later enqueue timestamp; after its completion receipt and batch resolution the replacement queue is [] instead of the fresh entry. No QA required (qaPolicy scope none).

### rev-30 · 2026-10-19T14:53:06.168Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-862-source
commit: dd18e84ff0f6a8a93fc7f26d3ee06ae527f6d230
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6098, no findings. Item/head/enqueued guard is inside the existing synchronous store transaction, before deletion and notice, matching batch pinned identity. T1 tests stale identity dimensions, exact removal and repeated notice suppression; T2 public cancellation/re-enqueue preserves a live batch, observes completion before separately bounded resolution, then proves replacement remains queued/item open. A-6097 reports controlled red→green plus three full files green. No new native process/wait/allowance or removed assertion. C1 is implementer-done; runtime criterion verification awaits exact-head mode-free task receipt before enqueue. No Reviewer tests.

### impl-862 · 2026-10-19T15:00:12.335Z

Same-head mode-free verification passed: 08193e6f-f84f-42f2-9102-0e57b7e61e03 at dd18e84ff0f6a8a93fc7f26d3ee06ae527f6d230, 442/442 tests, exit 0; log A-6118 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6118-suite-08193e6f-f84f-42f2-9102-0e57b7e61e03-auto-at-dd18e84.log). Linux droplet c-8 lon1, lifetime 347 s, cost $0.0241. Tree remains clean and head unchanged. T3 deferred to merge batch as configured. Reviewer final evidence verdict pending.

### rev-30 · 2026-10-19T15:00:23.153Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-862-final
commit: dd18e84ff0f6a8a93fc7f26d3ee06ae527f6d230
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6119, C1 verified, findings []. Exact-head mode-free 08193e6f/A-6118 full audit: ordinary 442/442, zero fail/cancel/skip/TODO, all 214 load groups 5/5, zero tier-mismatch rows. New pinned-identity T1 and live-batch cancel/re-enqueue T2 each pass ordinary and 5/5 (.040885/.266138 s ordinary). Source A-6098 and red→green A-6097 retain transaction/notice and replacement-queue contract. Claimant done present; no post-merge criterion wait needed. Inherited report-only budget/baseline debt retained; T3 landing remains Coordinator-owned. No further item run.

Criteria: C1 verified.

### coord · 2026-10-19T16:12:54.841Z

Merged 9ede6ee77195755ae71edd334f9a77a416db529f onto dev.
