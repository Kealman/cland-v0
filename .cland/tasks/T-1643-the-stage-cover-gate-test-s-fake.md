---
id: T-1643
kind: task
title: The stage-cover gate test's fake droplets miss their readiness deadline under load
state: open
status: backlog
size: XS
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: null
branch: null
created: 2026-11-02T22:55:56.936Z
updated: 2026-11-16T07:31:30.281Z
---

## Summary

`hub/test/suite-stage-cover.test.ts:21` "after-stage gates require Mac and sharded Linux at one tree, retain history and advance the next stage" failed in the macOS stage cover b153992b at dev 986afe46 (A-15991, 2 workers, T3 peak load 9.97). Its fake-droplet run reported `all unavailable: infrastructure … machine readiness deadline reached` for both shards, so the test's `/all exit 0/` assertion failed. Alone it passes 2/2 in 18.5 s, already over its 10 s T3 budget. The deadline (`executor/droplet/run.ts:66`) compares `clock.now()` to a limit. In this test the clock or the fake's readiness evidently runs on wall time, which a loaded Mac exceeds.

## What to build

Drive the fake droplet readiness and its deadline from the injected clock, or give the fixture a readiness deadline set by the test and independent of host load. Bring the test under its T3 budget.

## Acceptance criteria

- [ ] C1. The test passes 10/10 on macOS under a load gate at 10 (test).
- [ ] C2. A genuinely missed readiness deadline still reports `machine readiness deadline reached` (test).

## Comments

### coord · 2026-11-06T22:01:11.591Z

coord: second occurrence, a different symptom in the same test.

Periodic dev T3 ef3fd09f at dev 8d6b5c62 (A-17264; Linux x64 droplet c-8 lon1, T3 peak load 5.39) failed "after-stage gates require Mac and sharded Linux at one tree, retain history and advance the next stage" after 5.98 s. The test's inner local run 61634e27 reported `all exit 1; worker disappeared (killed or crashed without an exit receipt)`, with T0 exit 0 and `tests 1; pass 1`. So the test's `/all exit 0/` assertion at suite-stage-cover.test.ts:64 failed.

It was the only failure among 5261 passing tests. The same test passed in the E-1533 stage-1 covers ad7e8f92 (Linux) and 1e5be530 (macOS) at tree 2c721e12, which has the same code. Between that tree and 8d6b5c62 only a QA brief and durations.json changed, so this is not a regression of a merge.

Two failures of this test in a week, each with a different fixture symptom: the readiness deadline before, the worker exit receipt now. If it reddens a stage or release cover, promote it into the current release.
