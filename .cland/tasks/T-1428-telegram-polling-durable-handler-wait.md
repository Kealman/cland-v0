---
id: T-1428
kind: task
title: telegram-polling durable-handler wait fails once under a loaded macOS stage cover
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1204
branch: t/T-1428-telegram-polling-durable-handler-wait
created: 2026-10-28T14:23:52.818Z
updated: 2026-10-29T18:21:42.173Z
---

## Summary

`hub/test/telegram-polling.test.ts` "Telegram waits for durable handler completion and joins its writer on stop" failed once in the E-1311 stage-2 macOS cover ab376574 at cfcd0c61 (A-13338; two workers, peak load 20.95, fseventsd busy). It passed 5/5 alone on the same Mac right after (coord, 2026-10-28 14:24Z). Load flake: filed under the flaky-rerun rule.

## Acceptance criteria

- [x] C1. The failure is attributed from receipts (which wait or bound expired under load), and the test either passes 10/10 under two workers plus CPU load on macOS or its bound is sized from measured receipts.
  - done: impl-1428 · 2026-10-29T18:20:17.747Z

## Notes

First sighting. If the same identity is red again in a cover, it becomes a fix item in the running release.

## Comments

### impl-1428 · 2026-10-29T18:14:00.296Z

Baseline: macOS targeted durable-handler test passed 79.795 ms. Original A-13338 contains only generic “executor operation deadline reached” at deadline.ts:20/24 (1.426460916 s total), no await-site stack, so the original expired boundary cannot honestly be attributed from that receipt alone. Plan: name/time each of the three actual receipts (handler entry, cancellation, completed hub stop), reproduce under authorized exclusive stress capacity, then retain exact writer/offset assertions. Test-only change; no shared contract consumers to migrate.

### impl-1428 · 2026-10-29T18:20:10.279Z

A-13930 records the approved macOS arm64 2-test-worker + 10-CPU-worker probe: 10/10 target-case passes, probe wall 4.544 s, total with self-check 5.584 s, sampled peak 1-minute load 4.4668. Entry .017–.169 ms, abort .578–.778 ms, completed stop 2.441–4.567 ms. All native children closed. This did not recreate historical load 20.95 or reproduce the failure. Original A-13338 proves a native 1 s within bound expired; all three share the same timer stack, so exact historical boundary is unrecoverable. Keeping bounds unchanged and named diagnostics; decision question sent to lead about C1 interpretation. origin/dev fetched/merged before first review; only tracker file advanced.

### impl-1428 · 2026-10-29T18:20:24.366Z

C1 evidence interpretation accepted by Coordinator in decision 3fc9b8fa (answer_to 3eab0a9a): attribution is “one of three 1 s native receipt waits; the exact historical boundary is unrecoverable from A-13338”. The test now retains named timings/errors for all three. A-13930 proves 10/10 loaded macOS passes, honestly measured load 4.47 vs historical cover 20.95. No bounds widened. Head eb3da68be pushed to origin; source review queued with reviewer and this interpretation explicitly included.

### rev-32 · 2026-10-29T18:21:42.173Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261029-1428-source1
commit: eb3da68be3149be1a77537764f25e5394bf8c1b8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, Standards 0/Spec 0 findings; A-13933. All three 1000ms native bounds and writer/offset/stop/timer assertions preserved; exact names and monotonic timings make recurrence attributable. Original A-13338 cannot identify which of three waits expired; Coordinator 3fc9b8fa explicitly accepts that limitation with supplemental ten-pass local stress evidence. A-13917/A-13930 are claimant-authored local summaries, not raw configured receipts; measured load4.47 did not recreate20.95. C1 remains unverified pending same-head configured result and final original-record settlement. No Reviewer execution.
