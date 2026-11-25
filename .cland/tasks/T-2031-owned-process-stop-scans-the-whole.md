---
id: T-2031
kind: task
title: Owned-process stop scans the whole process table four times per stop and overruns its 1 s budget under Linux load; inspect only captured PIDs
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1782
branch: t/T-2031-owned-process-stop-scans-the-whole
created: 2026-11-20T09:57:59.356Z
updated: 2026-11-25T13:06:06.567Z
---

## Summary

T-1856's owned-process stop (`native.end`, 1,000 ms budget) takes about 380 ms on a quiet Mac, including four full-machine process snapshots of about 693 rows each (impl-1856's trace, A-22127). Under Linux T3 load the same stop exceeded its budget with "process inspection deadline reached" in 2 of 4 full-suite occasions (A-22024, A-22118), and passed in the others (A-22090, A-22135). The cost of a full-machine scan grows with every process on the box.

## What to build

Inspect only the captured native PIDs and their recorded descendants during stop (`ps -p`, or `/proc/<pid>` on Linux), not the whole process table, keeping the exact birth-identity checks. Measure stop time against the current full-scan path under load.

## Acceptance criteria

- [ ] C1. Stop inspection reads only the captured PIDs and descendants, with birth-identity checks unchanged, shown by a test that counts scanned rows (test).
- [ ] C2. The item's Linux droplet verify passes every prune-process-lifecycle load-gate identity 5/5, with no "process inspection deadline reached" (test).

## Comments

### coord · 2026-11-20T10:23:35.095Z

T-1856 source14 (45d2e7321) carries the scoped inspection: cland parses only captured roots and descendants (about 101 rows, against 5,471 before). Descendant discovery still uses `pgrep -P`, which enumerates the process table natively (procps-ng v4.0.4 pgrep.c). A Linux-native children walk (`/proc/<pid>/task/*/children`) would remove that remaining enumeration, if the Linux per-step trace in T-1856's final full suite shows it matters. Close this item when T-1856 lands unless that trace shows the need.

### impl-2031 · 2026-11-25T13:06:06.567Z

Consumer search: systemProcesses/endProcess production importers: hub/src/{remote/poller-lease,prune-processes,fixture-processes,git-command-owner,termination-owner,executor/local,host/local,orphans,suite-command}. Linux descendant selector changes only; default full ps and Darwin pgrep retained, no wire or persisted schema change. Shared probe importers include system-processes, Claude/session lifecycle, measure-memory, suite-cancel and fixture orphan lifecycle tests. Existing seam approved in launch: endProcess owned-tree fake native boundary. Red receipt: Linux enumeration assertion actual 6 pgrep calls, expected 0, Node 24.21.0 macOS synthetic Linux.
