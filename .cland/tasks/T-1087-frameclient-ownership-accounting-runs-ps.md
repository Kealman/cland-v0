---
id: T-1087
kind: task
title: FrameClient ownership accounting runs ps for the in-process fixture's synthetic pids
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-21T23:17:06.345Z
updated: 2026-10-29T15:59:08.337Z
---

## Summary

In the in-process Claude fixture, FrameClient's result-ownership accounting calls `execFileSync`/`ps` for the synthetic positive pids the fixture invents. That makes report-only T2 resource warnings in T2 runs (seen in A-8786, T-1034's run 4437665a). The fixture's process facts are synthetic, so native cleanup accounting has nothing to check.

## Acceptance criteria

- [ ] C1. Synthetic process facts from the in-process fixture skip native ps/execFile accounting, and the T2 run reports no child_process warnings from FrameClient ownership accounting (test).
- [ ] C2. Native fixtures that start real processes keep their ownership accounting and cleanup checks unchanged (test).
