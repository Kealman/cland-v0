---
id: T-1655
kind: task
title: host-allow-list 'immediate merge revokes every host lease' runs 5.1–6.7 s on macOS against its 5 s budget
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
regression_of: T-1597
topic: null
branch: null
created: 2026-11-03T05:03:24.374Z
updated: 2026-11-03T05:03:24.374Z
---

## Summary

`hub/test/host-allow-list.test.ts` :: "immediate merge revokes every host lease before landing the task" exceeds its 5 s per-test budget on macOS: 6.678 s in the E-1536 stage-4 macOS cover (A-16171) and 5.117 s in impl-1654's local run (load 4.88). Budgets are report-only today, but this case would fail once enforcement returns (T-931).

## What to build

Find what dominates the case's time on macOS (a real merge, process spawns, lock waits) and cut it so the case stays under its budget on macOS with headroom, or move it to the tier and budget its cost justifies. Record the choice.

## Acceptance criteria

- [ ] C1. The case runs under its budget with at least 30% headroom in five local macOS repetitions under ordinary load, or sits in a tier whose budget it meets, with the reason recorded (test).
