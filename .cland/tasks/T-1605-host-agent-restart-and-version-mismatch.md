---
id: T-1605
kind: task
title: Host agent restart and version mismatch
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1599
  - T-1604
topic: null
branch: null
created: 2026-11-02T03:33:56.605Z
updated: 2026-11-03T22:00:58.272Z
---

## Summary

The hub's agent client reconnects after the agent restarts and re-reads its table. When the hello reports a version other than the hub's, the hub delivers its own code to the host over the master and restarts the agent through the supervisor. Harnesses survive either restart.

Hot files: `hub/src/host/agent-client.ts`, `hub/src/host/ssh-host.ts`, `hub/src/host/code-delivery.ts` (new), `hub/src/host/agent/server.ts`, `hub/test/host-agent-restart.test.ts` (new)

## Acceptance criteria

- [ ] C1. After `fake-host.ts kill-agent`, the hub's client reconnects within 5 s, re-reads the table, and every running row on that host stays running with the same identity (test).
- [ ] C2. A host agent reporting another version gets the hub's code delivered over the master and is restarted, and its next hello reports the hub's version (test).
- [ ] C3. Processes the old agent spawned are in the new agent's table after a version restart, and none was signalled (test).
- [ ] C4. Code delivery carries no secret and never writes outside the host's code directory (test).

## Notes

Shared files: `hub/src/host/ssh-host.ts`; the agent protocol module (hello)
