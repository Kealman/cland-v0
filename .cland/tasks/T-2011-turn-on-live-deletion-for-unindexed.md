---
id: T-2011
kind: task
title: Turn on live deletion for unindexed suite-run directories after a replay of T-1992's report-mode classification
state: open
status: planned
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-19T17:35:06.748Z
updated: 2026-11-19T17:50:03.470Z
---

## Summary

T-1992 switches live deletion on for indexed suite runs, but classifies the roughly 91,000 run directories the hub's index doesn't know in report mode only (rule 27). That unindexed class has never run in report mode on a live hub. This item turns on live deletion for it, after replaying the live report lines that T-1992's unindexed classification emits. It's the bulk of the `.cland/run/suites` growth that feeds macOS fseventsd.

## What to build

After T-1992 has landed and a hub restart has run its unindexed report mode for at least a few passes, replay those live report lines (would-retire counts by class) through the production checker. Then enable deletion for the unindexed class through the same guarded batch owner and per-pass cap.

## Acceptance criteria

- [ ] C1. The replay artifact lists the live unindexed would-retire counts by class from T-1992's report lines, and the first live sweep retires no unindexed run that is referenced, has any file newer than the floor, or has a tree beyond the inventory bound (artifact plus test).
- [ ] C2. A live pass over unindexed runs on a 50,000-root fake fixture keeps `task.view` within its bound and records pass IO time (test, native slot).
- [ ] C3. Before removal, the guarded owner rechecks the newest descendant mtime, not just the root's (`retireSuiteRun` checks only root mtime at suite-raw-coverage.ts:87), or fences writers by identity. A deterministic control rewrites a nested file between inventory and removal and shows the run kept (test).
