---
id: T-818
kind: task
title: Stage runs load-gate a T4 latency test five times in parallel, so tracker-load fails on a slow droplet disk
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-18T19:36:00.067Z
updated: 2026-10-18T19:36:00.067Z
---

## Summary

The E-678 stage-1 Linux run e2915ae9 at c7417944 (A-5544, shard-1) failed only on its load gate. `hub/test/tracker-load.test.ts` › "tracker requests stay within 5 s with 20 sessions and 200000 retained events" passed 4 of 5 repetitions run alongside the phase; the failing one finished at 4.26 s. That shard's disk was slow (fsync 47 ms, SQLite 99 ms, against about 8 ms on the other shard). The test is T4, and stage runs now include T4 through the soak selection (T-714). Five concurrent copies of a latency-bound load test next to a full phase measure the machine more than the tracker.

## Acceptance criteria

- [ ] C1. Load-gate repetitions skip, or run serially, tests that assert a wall-clock latency bound under self-generated load (T4 load tests such as tracker-load); the run's result names that choice, and a component test proves it.
- [ ] C2. The next stage-occasion droplet run at an unchanged tree runs tracker-load exactly as the soak selects it, and it passes.
