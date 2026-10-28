---
id: T-1425
kind: task
title: A merge batch blocked by a failed follow-up after landing never clears, and the queue stops behind it
state: open
status: backlog
size: S
labels:
  - P1
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-28T12:21:37.799Z
updated: 2026-10-28T12:21:37.799Z
---

## Summary

A merge batch whose landing succeeded but whose follow-up failed (`merged, follow-up failed: stop sessions: cannot inspect the OS process table: ps failed or timed out`) stays blocked for good, and the merge queue stops behind it. MergeBatches #tick skips every landed member, then returns at `if (batch.failed && !batch.retryLanding) return;`, and no path clears `failed` once all members are landed. Finishing the follow-up with `cland merge T-n` doesn't clear the batch, and a hub restart keeps it, because the batch lives in store meta. Seen 2026-10-28 11:49Z: batch ca93a32f (T-1391 alone) blocked; T-1391 closed with a merge receipt after `cland merge T-1391`; T-1402 queued behind it since 11:55Z with no progress. On 2026-10-24 (T-1209) the same block cleared only because a second member could be cancelled and re-enqueued.

## Acceptance criteria

- [ ] C1. A blocked batch whose members are all landed or completed is cleaned up and cleared on the next tick, and the queue goes on to the next entry (test: fail a follow-up after landing, finish it with cland merge, then show the next queued item batched).
- [ ] C2. A follow-up failure after a successful landing doesn't block the queue: the batch records the failed step on the landed item, reports it, and the queue continues (test with a ps-timeout follow-up).
- [ ] C3. Startup clears a persisted blocked batch whose members are all landed (test).

## Notes

Incident in T-204 (2026-10-28 11:48–11:50Z, load 9–12, swap 12.5 of 13.3 GB). Code: hub/src/hub/merge-batches.ts #tick and #advance; isLanded is item closed plus merge receipt (dispatch.ts).
