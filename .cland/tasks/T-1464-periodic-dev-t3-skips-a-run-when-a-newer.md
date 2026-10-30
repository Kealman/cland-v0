---
id: T-1464
kind: task
title: Periodic dev T3 skips a run when a newer integrated or stage cover just passed
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: null
created: 2026-10-30T05:44:58.711Z
updated: 2026-10-30T10:16:25.870Z
---

## Summary

Periodic dev T3 cost $9.01 and 35.9 h in v0.3.0 (25 % of spend); three runs repeated what the stage covers had just proven (retro A-14149). Skip a periodic run when an integrated, stage or release cover at the same or a newer dev tip passed within the last hour, and say so in the notice. Retro v0.3.0 change 4.

## Acceptance criteria

- [ ] C1. A periodic tick after a fresh green cover at the same tip records a skip naming that cover.
