---
id: T-189
kind: task
title: "The item-loop demo: a real v0.1 ticket from claim to ready with one Coordinator delivery, measured from the journal"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-143
topic: null
branch: null
created: 2026-10-10T15:56:11.386Z
updated: 2026-10-10T17:03:11.835Z
---

## Parent

T-108 (A quiet Coordinator). The demonstration criterion moved out of T-143 on 2026-10-10: it can only run once T-143's loop is merged and live on a restarted hub, so it could not gate T-143's own merge.

## What to build

Run the item loop on a real v0.1 ticket, from claim to `ready`:
- the Implementer requests its own review;
- a not-clear verdict and a re-review pass between the Implementer and the Reviewer;
- there is one delivery about the item at the Coordinator after the launch (the `ready` event).

Measure it from the journal with T-82's `analyse.py` and record the result as an artifact. Fix anything the run shows is broken, or file it.

## Acceptance criteria

- [ ] A real v0.1 ticket runs claim → own review request → not-clear → re-review → ready, with exactly one Coordinator delivery about it after the launch, measured from the journal with `analyse.py`.
- [ ] The measurement and the journal excerpt are recorded as an artifact.
- [ ] Anything the run shows broken is fixed in this item or filed as a v0.1 item.

## Notes

Blocked by T-143 merged and the hub restarted on it. Size S.
