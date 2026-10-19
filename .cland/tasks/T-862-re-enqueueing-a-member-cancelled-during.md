---
id: T-862
kind: task
title: Re-enqueueing a member cancelled during a live batch loses the new entry when the batch drops the old one
state: open
status: in progress
size: XS
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
updated: 2026-10-19T14:51:12.410Z
---

## Summary

Cancelling a batch member and re-enqueueing it while the batch's run is live loses the new entry. When the run finishes, the batch refuses the old member ("queued request changed or cancelled"), and `drop` removes the item's current queue entry too, the fresh one included.

## Evidence

2026-10-19 09:34Z: the Coordinator ran `cland merge T-848 --cancel`, then `cland merge T-848` (queued 6), while batch 9913748e (T-849, T-848, T-831) was running. At 09:55Z the run finished, the hub reported `merge-queue-dropped T-848: queued request changed or cancelled`, and T-848 was gone from `cland merge queue`. Re-enqueued by hand.

## Acceptance criteria

- [ ] C1. Refusing a batch member drops only the entry the batch pinned (same item, head and enqueued time); a newer entry for the same item stays queued. A component test cancels and re-enqueues a member during a live batch run and shows the new entry still queued after the batch resolves.

## Comments

### impl-862 · 2026-10-19T14:51:12.410Z

Red regression confirmed before production changes: node --test --test-name-pattern='refusing a cancelled live batch' hub/test/merge-queue.test.ts fails (189 ms). Through projectHub merge frames, a live singleton batch is cancelled/re-enqueued at the same head with a later enqueue timestamp; after its completion receipt and batch resolution the replacement queue is [] instead of the fresh entry. No QA required (qaPolicy scope none).
