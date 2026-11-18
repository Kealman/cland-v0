---
id: T-1985
kind: task
title: A non-HubLocked termination-ownership acquisition rejection drops an already native-verified grace child before it is retained, so a reparented descendant can escape cancellation
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by:
  - T-1758
topic: null
branch: null
created: 2026-11-18T19:54:52.553Z
updated: 2026-11-18T19:54:52.553Z
---

## Summary

Deferred from T-1758's final review round (rev-39, head 500f78de4, under the review-loop cap). In `TerminationOwner.capture` grace discovery, HubLocked and timeout failures loop and keep cleanup incomplete. A non-HubLocked acquisition rejection, though, propagates before `owned.set`/`onCaptured` for a grace child whose native identity was already verified. If the parent then exits before a retry, that child has no retained receipt and can escape the cancelled run's cleanup. Not reproduced yet; found by source review. Set regression-of T-1758 once T-1758 closes.

## What to build

Retain a verified grace child's identity before any acquisition step that can reject. Or have such a rejection keep the cleanup incomplete with the identity retained, never dropped. Use a deterministic fault-injection seam on the reservation or acquisition step, and keep T-1758's self/ancestor fence and no-authority-from-missing-identity rules.

## Acceptance criteria

- [ ] C1. With an injected non-HubLocked acquisition rejection after a grace child's native identity is verified, followed by parent exit, the child stays tracked and is confirmed dead (native exit or ESRCH absence) or the cancel stays incomplete (test, red before).
- [ ] C2. T-1758's partial-validation and grace sibling-order regressions pass unchanged (test).
