---
id: T-700
kind: task
title: Remote run, close and demo files build one fixture per test and stop paying 2 s per fake droplet
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-697
topic: topic-443
branch: t/T-700-remote-run-close-and-demo-files-build
created: 2026-10-16T19:59:36.836Z
updated: 2026-10-17T14:20:29.564Z
---

## Summary

- `executor-run.test.ts` (104.2 s) rebuilds the whole fixture (git init, bare territory, clone, snapshot, hub, spoke) for each `t.test` sub-case.
- `suite-close-recovery.test.ts` (31.8 s) shares the 2000 ms machine-ready delay, about 24 fake droplets across the two files (memo §2.2 win 5; report-slice3 #3).
- `suite-stage-cover.test.ts` (47.3 s) runs three 15 s two-shard runs of one fixture, and its supersede rule duplicates `suite-cache`'s.
- `suite-close.test.ts` (39.2 s) pairs cap and slots, and its occasion permission refusals are pure.
- `demo.test.ts` (45.5 s) has one test duplicating another (report-slice1 #10, report-slice2).

## What to build

The fixture is built once per `test()`; sub-cases share it. The process machines use T-697's 200 ms ready delay. The stage-cover failed and unreported pair is one test, its supersede rule a T1 test. The suite-close cap and slots pair is one test, its occasion refusals a T1 table. The duplicate demo test goes. The lifecycle cases stay T3 with headers: provider loss, cancel, restored launching suite, restart reconciliation, watchdog and recorder.

## Acceptance criteria

- [ ] C1. The five files' manifest seconds fall from 268.0 s (A-3877) to 180 s or less.
- [ ] C2. Fake droplets created by the five files fall from the count recorded before (from the fake provider's request log) by at least a third.
- [ ] C3. Every remaining T3 test in the five files names its process behaviour, and the moved rules pass the tier lint as T1.
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Comments

### coord · 2026-10-16T20:10:05.236Z

Coordinator, scope note from T-680's review (A-4174): executor-run.test.ts:49, the broad host-receipt reuse scenario T-680 added, runs 15.9 s, over the 10 s T3 target. This ticket's move of executor-run onto the clock and the in-process provider includes it. Narrow it, or retier it, while keeping one real worker proof of reuse.

### coord · 2026-10-17T06:43:06.037Z

Coordinator correction from T-697: CLAND_TEST_DROPLET_MACHINE_MS is a readiness timeout in waitForMachine, not a fixed delay before the machine is ready. Lowering it from 2000 to 200 doesn't save 1.8 s per droplet by itself, so this ticket's speedup comes from the fixture and process work it removes (one fixture per test, in-process provider and scripted machine from T-697). Measure and report it that way. A case that needs real readiness timing keeps an explicit override, as T-697 did for the demo watchdog.
