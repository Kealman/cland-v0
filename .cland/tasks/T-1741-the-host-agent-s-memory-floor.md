---
id: T-1741
kind: task
title: The host agent's memory floor
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by: []
topic: null
branch: null
created: 2026-11-07T16:01:57.416Z
updated: 2026-11-07T16:02:21.028Z
---

## Summary

The host agent refuses a `spawn` when the host's available memory is below 1.3 GB, the typecheck reserve, whatever the slots say. The refusal carries a typed code, `memory-floor`, in the agent reply, and the hub's ssh Host surfaces it as a typed launch refusal. A fake host can report a set amount of free memory, so tests and the QA demo can trigger the refusal.

## What to build

One reading of available memory: `MemAvailable` on Linux, and on a fake host an override file in the fake host's directory. The agent reads the override only when its environment carries the fake-host marker. The agent checks the reading before a spawn and keeps reporting it in the existing `memory` event. The hub-side error type lets T-1744 treat the refusal as "host full".

## Acceptance criteria

- [ ] C1. The host agent refuses a spawn with code `memory-floor` when available memory is below 1.3 GB and spawns when it is at or above it (test).
- [ ] C2. A fake host set to report 1.2 GB free refuses the spawn, and its `memory` event reports that amount (test).
- [ ] C3. The ssh Host raises a typed memory-floor refusal that names the host and the free memory, distinct from a spawn failure (test).
- [ ] C4. The memory override file is ignored by an agent without the fake-host marker (test).

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/agent/server.ts`, `hub/src/host/agent/processes.ts`, `hub/src/host/agent/protocol.ts` (reply code), `hub/src/host/ssh-host.ts` (typed refusal).
- Tests: `hub/test/host-agent.test.ts` (T3, edit), or a new T2 agent-operations test with an injected memory reader.
- Serves epic C2.
