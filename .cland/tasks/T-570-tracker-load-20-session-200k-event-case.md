---
id: T-570
kind: task
title: tracker-load 20-session, 200k-event case passes only 4/5 under the load gate on a droplet
state: open
status: backlog
size: S
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-326
blocked_by: []
regression_of: T-548
topic: null
branch: null
created: 2026-10-16T04:34:57.365Z
updated: 2026-10-16T13:23:47.564Z
---

## Summary
T-548's new hub/test/tracker-load.test.ts case for 20 sessions and 200,000 events passed 5/5 under the load gate in T-548's own run f4fb4357 (A-3657). In T-296's droplet run c1acaff2 at 16d819bc (A-3703), on a different branch, the gate saw it pass only 4/5. T-296 doesn't touch the tracker or journal. Until the next stage-close durations refresh, the case counts as new, so the load gate repeats it in every task verify.

## Acceptance criteria
- [ ] C1. Find which bound fails on the failing repetition (the 5 s request budget, the fixture's setup time or a timeout), and make the case stable under droplet load without loosening the 5 s request bound it exists to prove; record the cause on this item.
- [ ] C2. tracker-load.test.ts passes 10/10 serially as a whole file on the Mac and its load gate 5/5 on a droplet in the task's verify.

## Comments

### coord · 2026-10-16T13:23:27.286Z

Recurred in the v0.1.3 release run 7d9819c9 at 4fb70e6e, shard-1 (A-3916, Linux c-8): tracker-load.test.ts:12 "tracker requests stay within 5 s with 20 sessions and 200000 retained events" failed at 4.90 s. The error was `database is not open` from Store.roleOf (store.ts:549), reached through publishUsage from a test timer (line 43). That points to a teardown race, a usage timer still publishing after the store closed, as much as to timing. The flaky-rule resubmit b663c7dd runs at 098e6f5a.

### coord · 2026-10-16T13:23:47.564Z

Correction from QA (qa-27, run qa-2026-10-16-27-24): in A-3916 the 5 s request bound held. The request maxima were task.view 2084 ms and task.criterion 2004 ms, and 4.90 s was the whole test's duration. The failure was only `database is not open` (ERR_INVALID_STATE) from the test's publishUsage timer at line 43, firing after the Store closed. Cause for C1: a teardown race in the test, not request latency.
