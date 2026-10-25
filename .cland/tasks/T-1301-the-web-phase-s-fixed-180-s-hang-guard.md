---
id: T-1301
kind: task
title: The Web phase's fixed 180 s hang guard kills healthy slow runs
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1282
blocked_by: []
topic: null
branch: null
created: 2026-10-25T11:59:19.395Z
updated: 2026-10-25T11:59:36.327Z
---

## Summary

`hub/test/run-suite.ts` kills the Web phase after a fixed 180 s of total wall time. The guard was sized when Web had 16 files (A-9371, A-9419); it now has 44 files and a healthy Linux c-8 Web phase takes 140–164 s, so ordinary droplet variance (about 40 % on Linux Web timings) crosses the guard. T-543's mode-free run a311c2d5 (A-11862) was killed at 186 s mid-file with no assertion failure, its Web tests uniformly 20–30 % slower than the green A-11845.

Make the guard detect a hang, not a slow run: fire on no test progress (no start/finish event from the Web runner) for a bounded window, keeping a generous total ceiling derived from the projected Web wall rather than a constant.

## Acceptance criteria

- [ ] C1. A Web phase that keeps emitting test progress is never killed by the hang guard before the total ceiling, and the ceiling is derived from the projected Web wall (at least 2.5× it), not a 180 s constant; a test with a fake clock proves a slow-but-progressing phase survives past 180 s.
- [ ] C2. A Web phase that stops emitting progress for the no-progress window is killed with a message naming the stalled file and the window, and its owned processes are cleaned up; a test with a held Web child proves it.
