---
id: T-1972
kind: task
title: A tracker storage stall on a read-only planned check still exits the hub with running suites (repeat class after T-253/T-483)
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: null
branch: null
created: 2026-11-18T12:31:23.399Z
updated: 2026-11-25T13:02:27.979Z
---

## Summary

Three minutes after restart #84 (2026-11-18, hub pid 20702 at 85–109% CPU from start, `slow-request` lines at 12:26:35–43Z), the hub logged `tracker-storage-stalled` for a "planned check" on E-1883 (started 12:26:57.008Z, warning threshold 5000 ms), declared it fatal at 12:27:57.102Z after 60 s, and abandoned the queue behind it (two more planned checks on E-1883 and ready checks on T-953, T-1642 and others). It then exited with code 1 ("shutdown deadline expired; exiting with code 1 before cleanup completed"), with three remote suite runs in flight; launchd respawned it. The same exit message appears twice earlier in hub.log. T-253 made a serving-time stall fail fast and T-483 moved the exit off the 5 s warning, but a read-only check that stalls under CPU load still kills the hub and every session's connection.

## What to build

Make the fatal path depend on what stalled. A stalled read-only check (planned, ready or summary computation) is cancelled and reported, and its callers retry or degrade, while the hub keeps serving; only a stalled write that may leave storage inconsistent exits. Record the CPU and event-loop delay at the stall, so the cause is diagnosable.

## Acceptance criteria

- [ ] C1. A fake tracker whose read-only planned check never settles produces a structured stall diagnostic and a refused or degraded reply to its caller, and the hub keeps serving other requests (test).
- [ ] C2. A stalled write still exits as today, after recording its pending writes (test).
- [ ] C3. The stall diagnostic includes the operation kind, item, wait time, queue depth and event-loop delay at the stall; every caller of the tracker queue's fatal path is listed (rule 41) (test).
