---
id: T-1473
kind: task
title: "`session retry` also forces a held queued delivery"
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
created: 2026-10-30T07:50:18.352Z
updated: 2026-10-30T07:50:18.352Z
---

## Summary

`retry` accepts only `uncertain` deliveries, so the human had no command for a held `queued` one.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [ ] C1. `cland session retry <s>` with a human delivery queued for over 60 s sends it to the session's bridge regardless of the hub's busy state and logs `inject-retry` with `stage: queued`.
- [ ] C2. When nothing can be retried, the refusal names the message's current stage (queued, delivered, injected) and its age.
