---
id: T-1475
kind: task
title: Truthful bridge and flush logs
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: null
branch: null
created: 2026-10-30T07:50:18.785Z
updated: 2026-10-30T07:50:18.785Z
---

## Summary

`bridge-closed` is logged for non-current bridges, and `flushed` counts pending messages, not sent ones. Both made this incident look like a lost bridge and a dropped message.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [ ] C1. Closing a bridge that is not the session's current one logs `bridge-stale-closed`, not `bridge-closed`.
- [ ] C2. `bridge-connected` and `bridge-closed` carry the harness job id and pid of the mod's process.
- [ ] C3. `flushed` logs `sent` and `held` counts separately, with the hold reason.
