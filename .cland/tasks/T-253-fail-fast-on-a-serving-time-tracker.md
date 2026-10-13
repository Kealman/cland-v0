---
id: T-253
kind: task
title: Fail fast on a serving-time tracker storage stall (T-103 follow-up)
state: open
status: backlog
labels:
  - hub
assignee: null
parent: E-273
blocked_by: []
topic: null
branch: null
created: 2026-10-12T01:35:46.890Z
updated: 2026-10-12T11:35:23.784Z
---

## Parent

Follow-up to T-103 (v0.1.1). T-103 chose fail-fast over fencing tokens for a stalled tracker storage write. A native rename or link already handed to the OS can't be cancelled by an in-process token, so a late write could still publish. T-103 detects and reports stalls (`tracker-storage-stalled`, `hub status`) and bounds hub stop. It deliberately leaves out automatic termination during serving.

## What to build

When a tracker storage operation stalls past its deadline while the hub is serving, the hub fails fast. It logs the abandoned operation, tells sessions and the workbench, and exits non-zero, so a supervisor or the human restarts it, instead of queueing tracker work behind a write that may never finish.

## Acceptance criteria

- [ ] A held write past the fail-fast deadline during serving makes the hub exit with a clear error naming the operation and the item; a test proves it.
- [ ] No tracker mutation admitted after the stall commits before the exit.
- [ ] hub/README.md describes the behaviour and the restart path.
