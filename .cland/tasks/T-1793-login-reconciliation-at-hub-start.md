---
id: T-1793
kind: task
title: Login reconciliation at hub start
state: open
status: planned
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1779
  - T-1786
topic: null
branch: null
created: 2026-11-09T12:44:12.593Z
updated: 2026-11-11T09:03:52.375Z
---

## Summary

At start the hub lists the provider's volumes and frees each login whose host is gone, rather than leaving it `in-use`; a host its watchdog deleted while the hub was stopped is the case in point. The hub deletes reader volumes of gone hosts, and marks a login whose volume is missing `signed-out`, with that reason.

## What to build

A reconciliation pass after the host-lease reconciliation and before the pool runtime's first pass. For each provider, it reads `listVolumes(project)`, then:
- A login in use whose host is destroyed or unknown, or whose volume is detached, loses its binding and reads `ready`.
- A reader volume that is not attached is deleted, with a confirming read.
- A login whose volume is not listed reads `signed-out` with "volume missing".
- A failed inventory changes nothing, is retried on the next pass, and sends one Agents line.
- A tagged volume that matches no login is logged and left to the lost-work check.

## Acceptance criteria

- [ ] C1. A fake host deleted by its watchdog while the hub was stopped leaves its login `ready`, with the same volume, after the next start (test).
- [ ] C2. A login bound to a live host stays `in-use` through a restart, and its host's sessions keep using it (test).
- [ ] C3. A reader volume of a gone host is deleted at start with a confirming read (test).
- [ ] C4. A login whose volume the provider no longer lists reads `signed-out` with the reason "volume missing" (test).
- [ ] C5. A failed volume inventory changes no login, is retried, and sends one Agents line (test).

- [ ] C6. The pass leaves pending bindings and reader intents in creating/deleted phases (the T-1778 fence) to their owners' receipts, never clearing them by row edits, and records each confirmed volume deletion through LoginRecords.deleteStorage (test).
## Blocked by

- T-1779
- T-1786

## Notes

- Hot files: `hub/src/host/login-reconcile.ts` (new), `hub/src/host/host-restart.ts`, `hub/src/hub/daemon.ts` (the start order).
- Tests: new `hub/test/login-reconcile.test.ts` (T3: the hub stopped, the watchdog deleting a fake host, then a start; T2 for C3 to C5).
- Serves epic C9. The spec calls this inferred and verified in the live run; on fakes it is fully testable.
