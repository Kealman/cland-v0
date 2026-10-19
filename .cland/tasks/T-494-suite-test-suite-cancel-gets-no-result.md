---
id: T-494
kind: task
title: "suite test: suite.cancel gets no result within 500 ms while a live compatibility holder's ps probe is held (Linux, under load)"
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-555
branch: t/T-494-suite-test-suite-cancel-gets-no-result
created: 2026-10-15T13:04:30.452Z
updated: 2026-10-19T05:36:34.613Z
---

## Problem

`hub/test/suite.test.ts:1268` (harness.ts:449), 'admission stays responsive and bounds a held ps probe for a live compatibility holder', failed on Linux in T-465's droplet verify a3fe0258 at 6612ac3c (A-3001:3902–3907). There was no result for suite.cancel within 500 ms. T-465 doesn't touch suite.test.ts or the admission code. The run's peak 1-min load was 12.8 on a c-8, and suite.test.ts took 432 s against its 265 s baseline. A 500 ms response bound on a held ps probe looks too tight for that load, or the probe hold delays the cancel reply.

## Acceptance criteria

- [ ] C1. The case proves that admission stays responsive while the ps probe is held, using an observed boundary rather than a wall-clock 500 ms race. Alternatively, the product bound it checks is shown to be met under load and the test aligns with it. Every other assertion stays, and the root cause is recorded in the commit.
- [ ] C2. suite.test.ts and suite-recovery.test.ts each pass 20/20 serially, whole file and alone, on the Mac; the mode-free task verify passes at the reviewed head; and both files pass in the merge batch's Linux T3 run that lands this item (recorded on the item by the Coordinator).

## Comments

### impl-494 · 2026-10-19T05:36:34.613Z

T-813, T-825 and T-799 are already ancestors. None replaces the 500ms request races in the original held-ps case, now at hub/test/suite-recovery.test.ts:60. Both controlled baseline cases pass locally (2/2, 9.53s), but a temporary 750ms test-process scheduling delay immediately after sending suite.cancel reproduces the exact reported error. With the identical delay, the normal socket watchdog passes. This isolates the arbitrary reply timer, rather than cancellation waiting for admission, as the load-sensitive failure.

A new T2 socket test holds the compatibility occupied() observation until both status and cancellation replies have arrived; queued/pid-null state and exact cancellation acknowledgement are asserted before release. A negative product control temporarily awaited the admission check inside cancel: the regression goes red at suite.cancel; restoring production makes it green. All diagnostic mutation/delay code is removed. The real T3 live/stale ps termination assertions and all existing assertions remain, using the normal socket watchdog for replies.

Running both full T3 files 20x serially in isolated fixtures, as required by the updated C2. Host typecheck is green. No production changes retained.
