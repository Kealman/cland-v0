---
id: T-1947
kind: task
title: aide-migration.test.ts's process stays alive with its pipes open after all its tests finish, under full-suite load on macOS, so a local full run stalls for 10 minutes
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1608
branch: t/T-1947-aide-migration-test-ts-s-process-stays
created: 2026-11-17T16:41:11.786Z
updated: 2026-11-17T23:19:20.367Z
---

## Summary

Local macOS stage cover 4cce2ac6 at 0f36c7f38 (A-20902, 2026-11-17, workers 2, peak 1-minute load 10.77) ended "stalled: no output for 10 min". All 7 tests in hub/test/aide-migration.test.ts started and finished with outcomes, but the file-level finish never came. The runner's command stayed open with stdout and stderr open, and its tree held three node processes (pids 79705 and 83160 under 78770). Every other T2 file finished; web-upload.test.ts was the last. Alone, the file passes 5 of 5, about 2 s each. The previous local full run (249ae076, at 04d1f6a) finished this file normally, and Linux droplet runs at d040dbf pass it. So something the file starts (hubs through projectHub or inProcessSpoke, a FakeClock, or syncBuiltinESMExports patches) can outlive the last test under load.

## What to build

The file joins everything it starts before its last test returns, so its process exits on its own under load, and the runner's stall report names the process that held the pipes.

## Acceptance criteria

- [ ] C1. The leaked handle or child is named, with a reproducer that holds the process open at least once in N loaded runs and fails first (test or documented loop with N stated).
- [ ] C2. After the fix, the file's process exits within its normal time in N loaded runs, and the tests' owned hubs and timers are joined before exit (test).
