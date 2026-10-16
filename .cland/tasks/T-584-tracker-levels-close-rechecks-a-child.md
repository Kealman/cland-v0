---
id: T-584
kind: task
title: tracker-levels "close rechecks a child reopened during the parent temporary write" fails on a droplet since the in-process migration
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
regression_of: T-466
topic: null
branch: null
created: 2026-10-16T07:52:47.207Z
updated: 2026-10-16T07:52:47.207Z
---

## Summary
In T-470's droplet run 0d25c7a0 at 311933f1 (A-3842, lines 4466–4474), hub/test/tracker-levels.test.ts:87, the case "close rechecks a child reopened during the parent temporary write before rename", failed an equality assertion after 0.6 s. T-470 doesn't touch the tracker. On dev, on a quiet Mac, the case passed 3/3 alone. tracker-levels was the first file T-466 moved to the in-process hub, so the race between the child reopen and the parent's temp-write-and-rename may now run with different timing than under a spawned daemon.

## Acceptance criteria
- [ ] C1. Find whether the case depends on spawned-daemon timing (a test issue) or exposes a real recheck race in close (a product issue), fix the cause, and record it on this item. The recheck assertion stays.
- [ ] C2. tracker-levels.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.
