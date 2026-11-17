---
id: T-1761
kind: task
title: suite-recovery nested-runner setup wait uses the 15 s default and times out under macOS cover load
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: null
branch: null
created: 2026-11-07T23:19:52.447Z
updated: 2026-11-17T23:14:12.479Z
---

## Summary

`hub/test/suite-recovery.test.ts` "admission quarantines a dead run's recreated root and releases both compatibility locks" waits for its nested suite runner's fake child with `eventually(...)`. That wait uses the default setup budget, `testWaitMs()` (15 s). The wait covers a whole nested `runSuite` launch: a node --test runner, its worker, and the fake child's rename, kill and recreate. Under local macOS load that launch alone exceeds 15 s. Other nested-launch helpers in `harness.ts` use `testWaitMs(45_000)`.

## Evidence

- E-1534 stage-1 macOS cover 8e4e8dff (A-17640) at dev c130bac4, local darwin arm64, workers 2, peak 1-minute load 7.38. The run failed with `fake child recreated root after runner kill: not within 15000 ms` at `suite-recovery.test.ts:164`, after 15.98 s. That was the only failure; 6975 tests passed. The file was last changed by T-511.
- The case was run alone at the same tree, under the preservation lock with `CLAND_*` stripped, at a 1-minute load of about 4.5: 5/5 green.

## Acceptance criteria

- [ ] C1. The nested-runner setup wait uses a launch-sized budget, `testWaitMs(45_000)` like the other nested-launch helpers. Behaviour bounds keep their names and do not change.
- [ ] C2. A sweep of `suite-recovery.test.ts` and its sibling suite-runner tests lists, in an item comment, every `eventually()` that covers a nested runner launch with the default budget, and each one is fixed.
