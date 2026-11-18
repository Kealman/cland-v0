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
updated: 2026-11-18T13:25:29.069Z
---

## Summary

Found by impl-1973 in T-1973's second review (2026-11-18). The shared executor lease fixture `guardedLeaseCase` restores its seams in `afterCleanup`, after `drainFixtureWork`. A resource-cleanup promise that rejects has already left the pending set by then, so its settlement is treated as if the resource closed successfully. The native-launch guard and the seams can be restored while that resource is still open. T-1973 corrects its own new uses, and this item covers the shared fixture and its existing callers.

## What to build

`guardedLeaseCase` keeps its guard and seams until every resource has a positive successful-close receipt. A rejected cleanup keeps the guard in place and reports the rejection as the case's failure (rule 39), never as a successful close.

## Acceptance criteria

- [ ] C1. A resource whose cleanup rejects keeps the native-launch guard and seams installed, and the case fails with that rejection (test with a positive control).
- [ ] C2. Every caller of `guardedLeaseCase` is listed with its disposition (rule 41) and passes unchanged.
