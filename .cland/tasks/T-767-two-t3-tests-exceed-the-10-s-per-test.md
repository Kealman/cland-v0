---
id: T-767
kind: task
title: "Two T3 tests exceed the 10 s per-test budget: typecheck pinned compilers (13.5 s) and the startup-smoke planted hang (10.9 s)"
state: open
status: backlog
size: S
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-18T03:04:17.694Z
updated: 2026-10-18T03:04:17.694Z
---

## Summary

T-745's final full run 6fc7984b (A-4904, 2026-10-18 03:02Z) has no T1/T2 budget overruns left. Two T3 tests still exceed the 10 s per-test budget in report mode, and have across today's covers:
- hub/test/typecheck.test.ts "typecheck resolves pinned compilers in roots and linked worktrees": 13.5 s, regressed from a 12.0 s baseline.
- hub/test/startup-smoke.test.ts "a planted listening startup hang fails the smoke within its bound and names the last log event": 10.9 s.
Budgets turn hard one week after tiers.json landed (D53).

## What to build

Bring both under 10 s on the droplet with margin: a smaller compiler fixture or a shared compile for the typecheck case, and a shorter injected hang bound for the smoke case. Keep what each proves. Only if a case truly needs the time, give it an owned allowance with a reason.

## Acceptance criteria

- [ ] C1. A full droplet run shows neither test in a "would fail" T3 budget line, with both tests' assertions unchanged in meaning.
