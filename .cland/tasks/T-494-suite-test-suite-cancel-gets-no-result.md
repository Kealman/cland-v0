---
id: T-494
kind: task
title: "suite test: suite.cancel gets no result within 500 ms while a live compatibility holder's ps probe is held (Linux, under load)"
state: open
status: review
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
updated: 2026-10-19T05:51:59.043Z
---

## Problem

`hub/test/suite.test.ts:1268` (harness.ts:449), 'admission stays responsive and bounds a held ps probe for a live compatibility holder', failed on Linux in T-465's droplet verify a3fe0258 at 6612ac3c (A-3001:3902–3907). There was no result for suite.cancel within 500 ms. T-465 doesn't touch suite.test.ts or the admission code. The run's peak 1-min load was 12.8 on a c-8, and suite.test.ts took 432 s against its 265 s baseline. A 500 ms response bound on a held ps probe looks too tight for that load, or the probe hold delays the cancel reply.

## Acceptance criteria

- [x] C1. The case proves that admission stays responsive while the ps probe is held, using an observed boundary rather than a wall-clock 500 ms race. Alternatively, the product bound it checks is shown to be met under load and the test aligns with it. Every other assertion stays, and the root cause is recorded in the commit.
  - done: impl-494 · 2026-10-19T05:50:06.115Z
- [ ] C2. suite.test.ts and suite-recovery.test.ts each pass 20/20 serially, whole file and alone, on the Mac, and the mode-free task verify passes at the reviewed head. Their Linux T3 run comes from the merge batch that lands this item and is recorded by the Coordinator as landing evidence, not as a gate.

## Comments

### impl-494 · 2026-10-19T05:36:34.613Z

T-813, T-825 and T-799 are already ancestors. None replaces the 500ms request races in the original held-ps case, now at hub/test/suite-recovery.test.ts:60. Both controlled baseline cases pass locally (2/2, 9.53s), but a temporary 750ms test-process scheduling delay immediately after sending suite.cancel reproduces the exact reported error. With the identical delay, the normal socket watchdog passes. This isolates the arbitrary reply timer, rather than cancellation waiting for admission, as the load-sensitive failure.

A new T2 socket test holds the compatibility occupied() observation until both status and cancellation replies have arrived; queued/pid-null state and exact cancellation acknowledgement are asserted before release. A negative product control temporarily awaited the admission check inside cancel: the regression goes red at suite.cancel; restoring production makes it green. All diagnostic mutation/delay code is removed. The real T3 live/stale ps termination assertions and all existing assertions remain, using the normal socket watchdog for replies.

Running both full T3 files 20x serially in isolated fixtures, as required by the updated C2. Host typecheck is green. No production changes retained.

### rev-30 · 2026-10-19T05:51:59.043Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-494-source
commit: 310d5495a0309204ac4b5e9d0372d74ecb332e77
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; A-5803 audits Standards and Spec. New T2 real-socket/FakeClock barrier requires status and exact cancel acknowledgement before held inspection completes; blocked-cancel negative control is red and restored product green. T3 live/stale native PID and termination assertions retained, replacing only arbitrary 500ms reply watchdogs with the normal watchdog. Controlled scheduling red/green and root-cause commit retained. Raw Mac audit A-5802: suite.test 20/20 (220 pass), recovery 20/20 (120 pass), zero fail/cancel/skip. No production changes. Coordinator e51de247/revised C2 permits final marks after Mac+mode-free task gate; Linux T3 is landing evidence. C1/C2 final marks await exact-head task receipt. QA scope none.
