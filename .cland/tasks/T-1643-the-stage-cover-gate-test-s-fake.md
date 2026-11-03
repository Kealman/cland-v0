---
id: T-1643
kind: task
title: The stage-cover gate test's fake droplets miss their readiness deadline under load
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
created: 2026-11-02T22:55:56.936Z
updated: 2026-11-02T22:55:56.936Z
---

## Summary

`hub/test/suite-stage-cover.test.ts:21` "after-stage gates require Mac and sharded Linux at one tree, retain history and advance the next stage" failed in the macOS stage cover b153992b at dev 986afe46 (A-15991, 2 workers, T3 peak load 9.97). Its fake-droplet run reported `all unavailable: infrastructure … machine readiness deadline reached` for both shards, so the test's `/all exit 0/` assertion failed. Alone it passes 2/2 in 18.5 s, already over its 10 s T3 budget. The deadline (`executor/droplet/run.ts:66`) compares `clock.now()` to a limit. In this test the clock or the fake's readiness evidently runs on wall time, which a loaded Mac exceeds.

## What to build

Drive the fake droplet readiness and its deadline from the injected clock, or give the fixture a readiness deadline set by the test and independent of host load. Bring the test under its T3 budget.

## Acceptance criteria

- [ ] C1. The test passes 10/10 on macOS under a load gate at 10 (test).
- [ ] C2. A genuinely missed readiness deadline still reports `machine readiness deadline reached` (test).
