---
id: T-463
kind: task
title: session-usage restart publication test counts 2 publications against 1 under load (T-389's 100 ms window)
state: open
status: planned
size: XS
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-389
topic: null
branch: null
created: 2026-10-15T08:37:18.553Z
updated: 2026-10-15T09:16:21.060Z
---

## Summary

`hub/test/session-usage.test.ts:165` counted 2 restart publications where it expects 1 (line 176), in T-455's gate 1ea1e21d (A-2777), 2026-10-15. The whole file passed 5/5 alone at 9c90591b (A-2785). The case was last changed by T-389's c28bf3c4, which set the 100 ms usage window (startUsageDaemon). Under load, two publications land inside one count window. Count publications against an observed coalescing boundary rather than a wall-time window.

## Acceptance criteria

- [ ] C1. The restart case counts publications against the observed coalescing boundary, keeps its assertion's meaning, and the file passes 5/5 beside a local full run.
