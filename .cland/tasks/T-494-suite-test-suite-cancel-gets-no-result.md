---
id: T-494
kind: task
title: "suite test: suite.cancel gets no result within 500 ms while a live compatibility holder's ps probe is held (Linux, under load)"
state: closed
status: done
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
updated: 2026-10-19T07:11:29.710Z
closed: 2026-10-19T07:10:28.608Z
---

## Problem

`hub/test/suite.test.ts:1268` (harness.ts:449), 'admission stays responsive and bounds a held ps probe for a live compatibility holder', failed on Linux in T-465's droplet verify a3fe0258 at 6612ac3c (A-3001:3902–3907). There was no result for suite.cancel within 500 ms. T-465 doesn't touch suite.test.ts or the admission code. The run's peak 1-min load was 12.8 on a c-8, and suite.test.ts took 432 s against its 265 s baseline. A 500 ms response bound on a held ps probe looks too tight for that load, or the probe hold delays the cancel reply.

## Acceptance criteria

- [x] C1. The case proves that admission stays responsive while the ps probe is held, using an observed boundary rather than a wall-clock 500 ms race. Alternatively, the product bound it checks is shown to be met under load and the test aligns with it. Every other assertion stays, and the root cause is recorded in the commit.
  - done: impl-494 · 2026-10-19T05:50:06.115Z
  - verified: rev-30 [reviewer] · run rev-20261019-494-final · 2026-10-19T06:11:03.468Z · commit 310d5495a0309204ac4b5e9d0372d74ecb332e77
- [x] C2. suite.test.ts and suite-recovery.test.ts each pass 20/20 serially, whole file and alone, on the Mac, and the mode-free task verify passes at the reviewed head. Their Linux T3 run comes from the merge batch that lands this item and is recorded by the Coordinator as landing evidence, not as a gate.
  - done: impl-494 · 2026-10-19T06:10:23.878Z
  - verified: rev-30 [reviewer] · run rev-20261019-494-final · 2026-10-19T06:11:03.468Z · commit 310d5495a0309204ac4b5e9d0372d74ecb332e77

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

### impl-494 · 2026-10-19T06:10:37.475Z

Revised C2 claimant done: unchanged source-reviewed head 310d5495a0309204ac4b5e9d0372d74ecb332e77 passes the one mode-free configured droplet task verify 7a02ff65-1022-409b-a463-8bd0e701c838 (A-5807): 1468/1468, zero fail/cancel/skip. New T2 ordering regression passes ordinarily (A-5807:46615-46616) and all five fresh repetitions (A-5807:49086). Both full Mac files passed 20/20 serially with fresh isolated fixtures (A-5802), totaling 340 passing assertions. Host lint/typecheck pass. No source/head changes after source review.

Linux native T3 evidence remains Coordinator-owned landing-batch evidence per revised C2, not this task gate. Droplet linux x64 c-8 lon1, Node v24.21.0, Neovim v0.12.5; lifetime 1052s, cost $0.0730. Report-only inherited tier/duration diagnostics are retained in A-5807; no new regression tier overage.

### rev-30 · 2026-10-19T06:11:03.468Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-494-final
commit: 310d5495a0309204ac4b5e9d0372d74ecb332e77
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-5808 combines source A-5803, controlled sensitivity A-5799/A-5802, both complete Mac 20/20 sets (220+120 pass, zero fail/cancel/skip) and exact-head gate 7a02ff65/A-5807. T0–T2 1468/1468, zero fail/cancel/skip; new ordering test passes .229s and all five fresh repetitions. All 388 global groups pass 5/5. Five inherited report-only T-803 Git rows disclosed; no new-test trip. C1 and revised C2 verified, no findings. Coordinator e51de247 owns both files' Linux T3 landing-batch receipts as landing evidence, not a pre-enqueue gate; no task T3 execution claimed. QA scope none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T07:10:28.608Z

Merged 9ac260d83bbb806e576756279685a4c5072b0c32 onto dev.

### coord · 2026-10-19T07:11:29.710Z

Landing evidence (C2, recorded by the Coordinator, not a gate): merge batch 6a37ea5a (T-739, T-494), suite run 16aad891 on droplet c-8 lon1, Linux x64, tree 0537514b, 1690 pass / 0 fail. suite-recovery.test.ts held-probe cases passed: "admission stays responsive and bounds a held ps probe for a live compatibility holder" (1240 ms) and the stale-holder case (7110 ms); suite-admission-responsive.test.ts passed. Log A-5859. Landed on dev at 9ac260d8.
