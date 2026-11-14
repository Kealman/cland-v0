---
id: T-1853
kind: task
title: The demo watchdog test's fake machine readiness deadline expires under a loaded macOS full run
state: open
status: planned
size: XS
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-14T05:51:47.591Z
updated: 2026-11-14T05:52:16.592Z
---

## Summary

`hub/test/demo-release.test.ts` "the detached demo watchdog confirms an active droplet losing tags during its delete" failed in the T-1849 + T-1851 local batch 6fe26f5d (A-19286, head ba94089e5, darwin arm64, 1 worker), with `AssertionError: machine readiness deadline reached` from the `startDemo` helper (hub/test/demo-start.ts:38). It passed in all three of the hub's failing-file reruns, in about 4–5.3 s. The case runs entirely on fakes (fake DigitalOcean API and fake droplet).

## What to build

Find what the fake machine's readiness wait depends on under load: a fake-provider poll interval, a production readiness deadline that the helper consumes, or fixture startup. Then make setup readiness use `testWaitMs()` scaling or a named bound sized for a loaded one-worker full T3 run. Any behaviour bound the case asserts stays exact. If a production readiness deadline is being cut by a held fixture step, name it rather than widening it.

## Acceptance criteria

- [ ] C1. The cause of "machine readiness deadline reached" under load is named on this item, and the helper's readiness wait no longer depends on an unscaled real-time bound (test).
- [ ] C2. The case passes five lone repetitions and one paired run on macOS, plus the task's mode-free verify (test).
