---
id: T-2061
kind: task
title: The periodic dev T3 run executes T2, T3 and Web unsharded on one droplet and can exceed the 75-minute run timeout, reporting a red with no failing file
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-22T17:59:44.060Z
updated: 2026-11-22T17:59:44.060Z
---

## Summary

Periodic dev T3 run ae9e60c1 (2026-11-22, dev 022d75601, one c-8 ams3 droplet, A-22630) ended with exit 124 at the 75-minute run timeout. It had completed 6,763 tests with 0 failed, but 48 T3 files and all 55 Web files went unexecuted. The culprit search reported "inconclusive; no failing files identified". The same head was green in the sharded integrated cover d6245a18 (all tiers, 9,544 tests, about 62 minutes). On this run the droplet's T2 took 1,241 s, against 846 s in d6245a18, and its disk fsync was 10.45 ms against about 4 ms. The single-machine budget has no margin: T-2036 found that one c-4 can't finish a full suite in 75 minutes either.

## What to build

Run the periodic dev T3 occasion on the configured shards, as batches and covers already do. Alternatively, size its run deadline from its tier projections. Also, label a timeout with no failing file as inconclusive (a capacity problem) rather than as a red regression of the merge range.

## Acceptance criteria

- [ ] C1. A periodic dev T3 run uses the configured shard count, or a projection-sized deadline, so a green tree completes within its deadline (test).
- [ ] C2. A periodic run that times out with no failing test is reported as inconclusive (timeout), not as red, and names the unexecuted tiers (test).
