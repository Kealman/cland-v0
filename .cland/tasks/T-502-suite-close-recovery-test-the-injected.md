---
id: T-502
kind: task
title: "suite-close-recovery test: the injected machine loss can land after shard 1 already passed (Linux)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-395
topic: topic-319
branch: t/T-502-suite-close-recovery-test-the-injected
created: 2026-10-15T14:57:11.991Z
updated: 2026-10-15T20:40:43.961Z
---

## Problem

`hub/test/suite-close-recovery.test.ts:54`, T-395's lost-machine case, expects `/shard-1: remote machine lost/`. In T-456's droplet verify ae7c7a40 (A-3082:3993–4018) on Linux, both shards passed with exit 0 instead. The fake machine loss apparently lands after shard 1 has already finished, so the test races its own fault injection. This is T-395's new test, so it's rework of T-395.

## Acceptance criteria

- [x] C1. The fault is injected at an observed point where shard 1 is still running, using a gate in the fake executor rather than wall-clock timing, so the case always exercises the lost-machine path. Every assertion stays, and the root cause is recorded in the commit.
  - done: impl-502 · 2026-10-15T19:19:37.828Z
  - verified: rev-30 [reviewer] · run rev-20261015-502-source · 2026-10-15T19:22:00.568Z · commit 5932d8a6abdf4ec46f9ce0e93e21bbfe2f8d5d55
  - verified: rev-30 [reviewer] · run rev-20261015-502-allowance-delta · 2026-10-15T20:12:24.683Z · commit e60f59c5211ece630dbd3ef91b971b6c2d58f723
- [x] C2. suite-close-recovery.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-502 · 2026-10-15T19:50:36.592Z

## Comments

### impl-502 · 2026-10-15T19:17:23.681Z

The worker started markers already establish both shards are running at their gates. The race is after provider removal: releasing shard 1 lets an already-admitted status poll collect its successful done marker before another poll sees 404. Fix keeps shard 1 gated through loss reporting, releases only shard 2, and relies on the existing registered owned-process teardown. No assertion or time bound changes.

### impl-502 · 2026-10-15T19:19:44.768Z

Committed 5932d8a6. The final fix releases the lost shard only after asserting the loss report, then waits for its done receipt before fixture removal, rather than leaving its live writer to teardown. Typecheck green; final-source Mac passes 1 and 2 are green (passes 4 and 5 in preliminary evidence log). Yielding one file to T-512, then completing the remaining three passes before review.

### rev-30 · 2026-10-15T19:22:00.568Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-502-source
commit: 5932d8a6abdf4ec46f9ce0e93e21bbfe2f8d5d55
scope: full

Source review T-502 clear at 5932d8a6abdf4ec46f9ce0e93e21bbfe2f8d5d55, parent a59514aefb3e5effe1c49ce9f6a3829a943540a6. No high, medium or low findings. Both review axes performed directly under no-delegation role.

Standards: exact diff changes only suite-close-recovery.test.ts (9 added/1 removed line), no production behavior or duration bounds. Existing observed package-start gates identify both shards before provider removal. Lost action releases only surviving shard2; restart still releases both; cancel still releases neither through this path. New done-receipt wait uses the existing bounded eventually seam. All previous merged-result/message-count/create-count/queue-release/provider-cleanup assertions remain.

Spec/C1 verified: DropletRun.status first asks the provider and then reads SSH run status. A 200 returned before removal could previously read a newly successful done marker after both gates were released, hiding the intended 404. Holding shard1 at its already observed package gate prevents that completion until a subsequent provider404 produces the asserted shard1 lost report. Only then does the test release shard1 and await its done receipt before fixture removal. The remote run.sh writes done as its final finish-trap operation after the package command and lock cleanup. f.remote already records process ownership, retaining failure-path reaping. Exact shard1 identity/provider removal and all original assertions/bounds remain. Commit and A-3289 record the cause rather than changing arbitrary sleeps.

C2 remains unverified: requester reports two whole-file Mac passes at final source with three more still running serially; durable completed five-pass evidence and an acceptable actual-droplet verification are pending. A-3289 is diagnosis/source-order evidence, not five-run proof. Source clearance permits the directed exact-head diff-selected verification under current Coordinator admission rules; final evidence settlement must inspect actual platform and complete five-run artifact. No per-item QA criteria.

Whitespace check is clear; requester reports typecheck green. No Reviewer tests, edits, merges or provider calls.

Criteria: C1 verified.

### impl-502 · 2026-10-15T19:50:41.437Z

C2 implementation evidence is complete at unchanged 5932d8a6: five serial quiet Mac whole-file passes in A-3292 and all five cases green in the actual Linux droplet receipt f23a4f38 / A-3310:2858–2862 (lost case 7.473s). Overall receipt is exit1 because suite-recovery:158 saw job.pid null and territory-lock:42 got guard failure rather than contention. Neither case is known in current E-482 list. Bugs/S reports sent to supervising Lead/Coordinator for classification and gate decision; Reviewer notified. No retry under the restart verification hold.

### rev-30 · 2026-10-15T19:50:55.251Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-502-linux-first
commit: 5932d8a6abdf4ec46f9ce0e93e21bbfe2f8d5d55
scope: evidence

First Linux evidence review T-502 not clear at unchanged source-reviewed 5932d8a6abdf4ec46f9ce0e93e21bbfe2f8d5d55. A-3310/f23a4f38 is actual Linux c-8, exit1:1820 pass/2 fail/3 platform skips. Typecheck and hub phases finish; Neovim smoke is not reached after unrelated hub failures.

All five suite-close-recovery cases pass (A-3310:2858–2862, timings5336–5340); repaired lost-shard case7.473s exercises the labelled loss then completes cleanup. A-3292 contains all five serial quiet Mac whole-file final-source passes,25/25 cases, natural completions. Its first two final-source runs came from the earlier loop only after the done-receipt edit was present; remaining three used committed identical source. Recorded guards and coordinated gaps are included. This establishes own-file runtime/platform evidence, but overall gate remains red.

Medium gate blocker / aside Bugs S — hub/test/suite-recovery.test.ts:158 (case:134): admitted-worker compatibility FIFO cancellation fixture asserts job.pid is truthy, but submission returned null (A-3310:4110–4125). The intended cancellation/racing-holder proof has not reached its staged worker boundary. Root cause is not established by this receipt.

Medium gate blocker / aside Bugs S — hub/test/territory-lock.test.ts:42 (case:36): expected contention error /another territory operation holds the lock/, received "could not take guard for .../territory.lock" from guarded/acquireLock (A-3310:4128–4151). This is a different lock-admission assertion, outside T-502; no production lock-safety failure is inferred without diagnosis.

Read-only item search finds historical ownership of these tests but no exact current E-482 classification. Requester already escalated both as Bugs/S to lead T-502. Coordinator disposition is required before treating this as known-only and taking a second gate attempt. C1 source fact stands; final C2 verification waits for an admissible overall gate. No own criterion is failed speculatively. Do not submit during current cover/restart hold8b300f2e, and do not edit outside-task sources without lead routing.

No Reviewer tests, edits or provider calls.

### impl-502 · 2026-10-15T19:51:10.325Z

Coordinator gate decision (2026-10-15 19:51Z): both A-3310 failures (suite-recovery job.pid null and territory-lock fixed sleep) are filed in E-482 and count as known. f23a4f38/A-3310 is receipt 1. After the explicit restart notice, submit receipt 2 with --executor droplet --fresh at unchanged reviewed 5932d8a6. Green or red only on different known flakes is the gate. No retry before the hold lifts.

### rev-30 · 2026-10-15T20:12:24.683Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-502-allowance-delta
commit: e60f59c5211ece630dbd3ef91b971b6c2d58f723
scope: delta

Delta source review T-502 clear at e60f59c5211ece630dbd3ef91b971b6c2d58f723, parent reviewed5932d8a6abdf4ec46f9ce0e93e21bbfe2f8d5d55. No high, medium or low findings. Standards and Spec: Only hub/test/durations.json changes: one allow entry for verification-workers.test.ts::requested size reserves its own price before create and fallback restores local configured workers, measured6.082s in cover38b71e4c at peak16.6, with concrete executor-round-trip reason and provenance. Exact delta matches Coordinator-posted fe233d71; no existing files/tests/allow value changes, no production/task-test/assertion-bound change or dev merge. No extra local rerun is required for this shared-only pick. Whitespace check is clear. Coordinator6adcdb0a lifts the hold, directs this pick and --executor droplet --fresh where Linux is needed; restarted hub now waits for remote capacity. No Reviewer tests, edits or provider calls.
C1 reverified: unchanged observed lost-shard gate, labelled loss assertion and release/done receipt ordering. C2 remains final-gate pending: A-3292 five whole Mac files and A-3310 Linux own5/5 stand. Coordinator d46189cf-c6f6-4470-8160-2476df521a5c independently confirmed both first-receipt outside failures classified known (null job.pid and territory guard boundary); A-3310 counts as receipt1. Source clear permits the directed second exact-head fresh droplet run; green or different known-only red is required. Shared-only allowance carries prior own source evidence; no claim that first overall red is final clear.

Criteria: C1 verified.

### impl-502 · 2026-10-15T20:40:38.678Z

Second directed Linux receipt 1f4cfb6f / A-3332 is green at exact delta-reviewed e60f59c5: 1837 tests, 1834 pass, 0 fail, 3 platform skips; hub and Neovim smoke complete, workers4, peak load13.28. Head unchanged/tree clean. C2 also has five serial quiet whole-file Mac passes A-3292. Reviewer has the final evidence request; await its final verdict and hub ready event.
