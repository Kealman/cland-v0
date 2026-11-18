---
id: T-1642
kind: task
title: A sharded close test waits 30 s of wall clock for its remote group and times out on a slow droplet
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1620
branch: t/T-1642-a-sharded-close-test-waits-30-s-of-wall
created: 2026-11-02T20:18:54.422Z
updated: 2026-11-18T11:19:40.881Z
---

## Summary

`hub/test/suite-close-recovery.test.ts:14` "a sharded close handles cancel with one result and confirmed cleanup" failed in the Linux stage cover 7b124b96 at dev d82f45fb (A-15968, shard 2) with `Error: remote group started: not within 30000 ms` after 31.95 s. Its budget is 10 s. The same test passed in every periodic dev T3 run today. The run used a fake droplet, and shard 1's machine had slow fsync (64 ms).

## What to build

Replace the fixed 30 s wall-clock wait on the remote group start with an event or a clock-driven wait (rule 23, wall-clock waits). Bring the test back under its 10 s budget.

## Acceptance criteria

- [ ] C1. The test waits on the group-start event or the injected clock instead of wall time, and passes 20/20 under a load gate at 10 (test).
- [ ] C2. Its duration is within the T3 per-test budget in the item's own mode-free droplet verify (evidence); later batch and cover samples are recorded at stage close, not required before merge.

## Comments

### impl-1642 · 2026-11-18T11:19:40.881Z

Consumer/scope map: changing only cancellation case in hub/test/suite-close-recovery.test.ts; same title and T3 classification retained for budget history. Native lost/restart cases unchanged. Shared integrated, remote-fixture, scripted-machine.started, remote-clock drive, fakeNativeGuard and readLeaseHistory already provide needed seams and will not change. Searched group-start wait and remote callers; no production/wire/config contract change. Matching per-file guide updated. Coordinator confirmed scripted cancellation seam and revised C2 to own mode-free verify sample; additional samples tracked at stage close.
