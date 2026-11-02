---
id: T-1616
kind: task
title: The hub keeps its heartbeat fresh and stops when it loses the lock
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1615
topic: null
branch: null
created: 2026-11-02T03:34:16.474Z
updated: 2026-11-02T03:34:43.813Z
---

## Summary

While it serves, the hub refreshes its lock's heartbeat on a timer under the break guard, by replacing the file whole. A hub that finds its lock naming another token has lost it, and it stops through its normal shutdown. A failed write is logged and retried, and never stops the hub by itself.

Hot files: `hub/src/hub/daemon.ts`, `hub/src/hub/lock.ts`, `hub/src/hub/agents-topic.ts` (one log kind, if surfaced)

## Acceptance criteria

- [ ] C1. While serving, the hub rewrites its lock's heartbeat every interval under the break guard, replacing the file whole, so a reader never finds the lock absent or half written (test).
- [ ] C2. With time driven by the hub's clock, a foreign contender stays refused across several lapse periods while the holder lives (test).
- [ ] C3. When its lock names another token, the hub logs `hub-lock-lost` and stops through its normal shutdown, removing no lock it does not own (test).
- [ ] C4. A failed heartbeat write is logged, retried at the next beat, and never stops the hub by itself (test).
- [ ] C5. A hub stop clears the heartbeat timer and removes the lock as today (test).
- [ ] C6. `daemon.test.ts` and `startup-cleanup.test.ts` pass with no test edited.

## Notes

Shared files: see Hot files
