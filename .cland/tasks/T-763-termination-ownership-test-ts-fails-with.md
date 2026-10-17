---
id: T-763
kind: task
title: termination-ownership.test.ts fails with "database is locked" on a slow droplet
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T22:57:38.301Z
updated: 2026-10-17T22:57:38.301Z
---

## Summary

In droplet run 4458319f (T-752 at 9096e2b4, A-4824, 2026-10-17 at 22:53Z), on a very slow disk, hub/test/termination-ownership.test.ts:11, "session stop and doctor share one termination owner and report the tree once", failed at line 21 with `Error: database is locked`. It passes 5/5 serially on the Mac at the same head (A-4833). T-752 doesn't touch it. The doctor and the hub open the same SQLite store concurrently without a busy timeout, or with one shorter than a slow disk needs.

## What to build

Every SQLite connection the test reaches (hub store, doctor reader) uses a busy timeout or retries on SQLITE_BUSY, so a slow disk delays the test but doesn't fail it. T-755's tmpfs temp root lowers the odds, but this fixes the cause.

## Acceptance criteria

- [ ] C1. A T2 test holds a write lock on the store for longer than the old failure window while doctor reads it; doctor completes, and the test fails before the fix.
