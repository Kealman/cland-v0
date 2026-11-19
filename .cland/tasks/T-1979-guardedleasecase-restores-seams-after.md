---
id: T-1979
kind: task
title: guardedLeaseCase restores seams after drainFixtureWork even when a rejected resource-cleanup promise has already left the pending set
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-18T13:25:29.069Z
updated: 2026-11-19T03:20:58.510Z
---

## Summary

Found by impl-1973 in T-1973's second review (2026-11-18). The shared executor lease fixture `guardedLeaseCase` restores its seams in `afterCleanup`, after `drainFixtureWork`. A resource-cleanup promise that rejects has already left the pending set by then, so its settlement is treated as if the resource closed successfully. The native-launch guard and the seams can be restored while that resource is still open. T-1973 corrects its own new uses, and this item covers the shared fixture and its existing callers.

## What to build

`guardedLeaseCase` keeps its guard and seams until every resource has a positive successful-close receipt. A rejected cleanup keeps the guard in place and reports the rejection as the case's failure (rule 39), never as a successful close.

## Acceptance criteria

- [ ] C1. A resource whose cleanup rejects keeps the native-launch guard and seams installed, and the case fails with that rejection (test with a positive control).
- [ ] C2. Every caller of `guardedLeaseCase` is listed with its disposition (rule 41) and passes unchanged.

## Comments

### coord · 2026-11-19T02:23:15.907Z

Confirmed again by impl-1957 during T-1957 (A-21490): the generic `guardedLeaseCase` default can restore seams and the native guard after a rejected cleanup, once the global pending set has emptied. T-1957 opts only its own new cases into a positive settlement fence; all legacy callers keep the old default. This item should migrate and audit those callers.

### coord · 2026-11-19T03:20:58.510Z

Second local opt-in: T-1857 adds a successful-cleanup fence limited to its new case, using the same names as T-1957's seam (`deferRestore`, `canRestore`, `releaseSeams`). This item should fold both T-1957's and T-1857's opt-ins into the shared `guardedLeaseCase` default and migrate the legacy callers.
