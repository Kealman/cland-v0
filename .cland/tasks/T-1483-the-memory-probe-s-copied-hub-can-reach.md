---
id: T-1483
kind: task
title: The memory probe's copied hub can reach live suite paths and recovery state
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1467
found_by: review
topic: null
branch: null
created: 2026-10-30T11:57:15.271Z
updated: 2026-10-30T11:57:15.271Z
---

## Summary

The T-1467 memory probe copies the live hub database into a disposable root, but the copied suite jobs keep absolute live paths (cwd, log, result) and unfinished recovery state. `projectHub`'s `isolateVerification` fences the lock paths, yet startup suite recovery and inspection read, and can write, those stored paths. So a scratch hub could touch live run files or act on live run state (found by impl-1478 while preparing T-1478, 2026-10-30 11:56Z; nothing measured yet).

## What to build

A probe or fixture hub started on a copy of a live project can reach nothing outside its disposable root. Before startup, the probe's sealed preparation rewrites or neutralises every persisted path and every unfinished recovery record in the copy. Recovery in a hub that runs with isolated verification refuses any path outside its own root. The probe report states what it excluded and keeps the finished-history row count. Today's full-startup probe runs on live copies were T-1476's at 08:04Z, 08:24Z, 09:12Z and 11:0xZ, and T-1467's own runs. Audit them from their saved outputs for any write or signal outside the scratch root, and record the answer.

## Acceptance criteria

- [ ] C1. A probe on a copy whose suite jobs carry live absolute paths and an unfinished running job starts, reaches readiness and stops without reading, writing or signalling anything outside its scratch root, shown by a fixture with a planted outside path and pid that stay untouched.
- [ ] C2. A hub with isolated verification refuses recovery actions on a stored path outside its root and names the job, while finished history keeps its row count.
- [ ] C3. The audit of today's live-copy probe runs is recorded on this item: each run, whether it reached suite recovery, and any outside path or pid it touched, or "none" with the evidence it rests on.
