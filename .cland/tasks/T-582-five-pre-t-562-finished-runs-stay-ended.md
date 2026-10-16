---
id: T-582
kind: task
title: Five pre-T-562 finished runs stay "ended without a posted result" in the heartbeat after two restarts
state: open
status: backlog
size: XS
labels:
  - hub
assignee: null
parent: C-326
blocked_by: []
regression_of: T-562
topic: null
branch: null
created: 2026-10-16T07:26:50.111Z
updated: 2026-10-16T07:26:50.111Z
---

## Summary
After the 04:54Z and 07:22Z restarts with T-562 live, the Coordinator heartbeat still lists five runs as "ended without a posted result": 97a70087, de3df9c9, 3df8e38c, 4cff14eb and 85b2c03a, all from before 02:56Z. Each has a result.json, and its item has merged and its worktree has been removed: T-550, T-556, T-505, T-559 and T-517. T-562's startup reconcile seems to skip runs whose item topic or worktree is gone, so they never post and never leave the stale list. They hold no slots, so the cost is only noise.

## Acceptance criteria
- [ ] C1. On startup, a finished run whose item has merged or closed is either posted to its topic or marked reported with a reason, and drops off the stale list.
- [ ] C2. A test restores such a run after a restart and shows it gone from the heartbeat's stale rows.
