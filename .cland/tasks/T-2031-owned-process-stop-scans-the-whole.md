---
id: T-2031
kind: task
title: Owned-process stop scans the whole process table four times per stop and overruns its 1 s budget under Linux load; inspect only captured PIDs
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: null
branch: null
created: 2026-11-20T09:57:59.356Z
updated: 2026-11-24T08:59:46.970Z
---

## Summary

T-1856's owned-process stop (`native.end`, 1,000 ms budget) takes about 380 ms on a quiet Mac, including four full-machine process snapshots of about 693 rows each (impl-1856's trace, A-22127). Under Linux T3 load the same stop exceeded its budget with "process inspection deadline reached" in 2 of 4 full-suite occasions (A-22024, A-22118), and passed in the others (A-22090, A-22135). The cost of a full-machine scan grows with every process on the box.

## What to build

Inspect only the captured native PIDs and their recorded descendants during stop (`ps -p`, or `/proc/<pid>` on Linux), not the whole process table, keeping the exact birth-identity checks. Measure stop time against the current full-scan path under load.

## Acceptance criteria

- [ ] C1. Stop inspection reads only the captured PIDs and descendants, with birth-identity checks unchanged, shown by a test that counts scanned rows (test).
- [ ] C2. The prune-process-lifecycle load gate passes 5/5 on every identity in two consecutive Linux full suites (test).

## Comments

### coord · 2026-11-20T10:23:35.095Z

T-1856 source14 (45d2e7321) carries the scoped inspection: cland parses only captured roots and descendants (about 101 rows, against 5,471 before). Descendant discovery still uses `pgrep -P`, which enumerates the process table natively (procps-ng v4.0.4 pgrep.c). A Linux-native children walk (`/proc/<pid>/task/*/children`) would remove that remaining enumeration, if the Linux per-step trace in T-1856's final full suite shows it matters. Close this item when T-1856 lands unless that trace shows the need.
