---
id: T-2047
kind: task
title: "T-1856 prune stop spawn cap counts load-dependent exit-polling rounds: macOS epic cover red at ps=19 > 18 although stops completed"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1856
topic: null
branch: t/T-2047-t-1856-prune-stop-spawn-cap-counts-load
created: 2026-11-21T03:46:20.633Z
updated: 2026-11-21T03:47:52.167Z
---

## Summary

The macOS epic cover 58b6b31c at dev b9573ba7b (A-22311) failed two of T-1856's prune stop cases (territory and legacy-ordinary) on the test's own spawn cap: "single-Git cancellation batches native probes: at most 18 ps, 8 pgrep, 24 perl and 48 total probe spawns; actual ps=19, pgrep=6, perl=19, total=44" and "actual ps=19, pgrep=7, perl=21, total=47". The stops themselves completed. The ps count includes exit-polling snapshot rounds, which grow with how long the killed process takes to die under load (peak 1-minute load 8.2). So a fixed total cap is load-sensitive, and the case is red on a busy Mac although behaviour is correct. This blocks the macOS full cover that closes six epics.

## What to build

Make the cap test what T-1856 meant, that probes are batched and not per-PID: bound the spawns per inspection round and the PIDs or rows per round, and bound the number of rounds by the stop's deadline rather than a fixed total. Keep the full-table-scan prohibition and every native assertion. No production change unless the extra rounds prove a real defect.

## Acceptance criteria

- [ ] C1. Under injected slow exit (extra polling rounds) the case passes when probes stay batched per round, and still fails if any round spawns per PID or scans the whole table, shown red first on the current cap (test).
- [ ] C2. The prune-process-lifecycle file passes 5/5 under the two-worker load gate on macOS (test).
