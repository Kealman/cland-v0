---
id: T-1154
kind: task
title: Droplet reservation waits ignore shutdown and can hold hub.stop for up to 60 s
state: open
status: planned
size: S
labels:
  - needs-triage
  - bug
assignee: null
parent: E-1284
blocked_by: []
topic: null
branch: null
created: 2026-10-22T19:53:59.804Z
updated: 2026-10-25T09:53:57.713Z
---

## Summary

Found by T-1151's reviewer, outside that item's held-create boundary. `DropletExecutor.#reserve` (hub/src/executor/droplet/droplet.ts around line 66) awaits `acquireLockWithRetry` before it checks for shutdown, and lock.ts allows a 60 s wait; `reserveSpend` has a similar wait. A hub stop that arrives while a run waits on the reservation lock can therefore still be held past the bounded shutdown T-1151 adds. This predates T-1151.

## What to build

Reservation and spend-ledger waits become cancellation-aware. On stop they stop waiting. A lock acquired after the stop began is released safely and never detached while still owned. No reservation is left counted against the daily cap or remote budget.

## Acceptance criteria

- [ ] C1. A hub stop while a run waits on the reservation lock or the spend ledger exits within 3 s, and a lock acquired late is released and not left owned (test).
- [ ] C2. No spend reservation or remote slot stays counted after such a stop, as shown by the next hub's executor status (test).
