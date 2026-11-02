---
id: T-1634
kind: task
title: The scratch Git helper's held-writer cancellation test fails on a slow droplet disk
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-02T14:37:15.028Z
updated: 2026-11-02T14:37:15.028Z
---

## Summary

`hub/test/git-maintenance.test.ts:38` ("scratch Git helper drains a held descendant writer before rejecting cancellation") failed in merge batch 60682c23 (run 93d2bcfe, log A-15873) with `writer 54403 is gone before the command rejects: true !== false`. The only member, T-1619, does not touch git maintenance: its diff is the droplet reaper, its test and docs. The droplet's disk was very slow (SQLite 1463 ms, fsync 67.7 ms; the usual is 11–35 ms and 3–8 ms). The test passed in periodic dev T3 at 4e8aa7ee, and 5/5 alone on macOS at 14:37Z.

Likely cause: the helper's rejection resolves before the descendant writer has been reaped. On a slow machine the writer stays visible to `pidAlive` (a live process or an unreaped zombie) for a moment after `rejected` settles.

## What to build

Make the drain contract deterministic. Either the helper awaits the writer's confirmed exit before it rejects, or the test waits on that exit signal, not on wall time. Don't retry and don't sleep.

## Acceptance criteria

- [ ] C1. The test passes 20/20 under an injected slow-reap seam that delays the writer's exit after SIGTERM by more than the current window.
- [ ] C2. The helper never rejects a cancellation while a held writer it started is still alive (test).
