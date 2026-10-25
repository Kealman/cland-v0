---
id: T-1298
kind: task
title: The droplet watchdog signals a persisted pid on a whole-second start time
state: open
status: planned
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1284
blocked_by:
  - T-543
topic: null
branch: null
created: 2026-10-25T10:54:46.064Z
updated: 2026-10-25T11:31:48.499Z
---

## Summary

The droplet watchdog's restart path (`watchdogAlive` / `stopWatchdog` in the droplet executor) still authorizes signals to a persisted pid on a whole-second start time. A pid recycled within the same second passes the check and can receive the signal. T-543 introduces the precise process identity for the adapter consumers; this item moves the watchdog onto it.

Found aside by impl-543 while migrating T-543's consumers (2026-10-25). Native child handles are safe; only the persisted restart path is affected.

## Acceptance criteria

- [ ] C1. The watchdog's persisted-pid liveness and stop checks use T-543's precise process identity and its one-time legacy-row upgrade; a test with a recycled pid of the same whole-second start time refuses the signal, and a legacy row whose start does not match, or whose identity cannot be read, never authorizes a destructive signal.
