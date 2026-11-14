---
id: T-1846
kind: task
title: Two T3 setup waits time out under a loaded macOS full run (session-native-lifecycle, suite-recovery)
state: open
status: in progress
size: S
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1500
branch: t/T-1846-two-t3-setup-waits-time-out-under-a
created: 2026-11-13T21:05:09.114Z
updated: 2026-11-14T01:20:18.711Z
---

## Summary

Two T3 cases timed out in the E-1537 stage-2 macOS cover 14cf91c6. It ran on dev 8efd8f0aa (log A-19218), local darwin arm64, 1 worker, peak 1-minute load 7.47. Both cases pass alone 5/5. Their wall-clock setup bounds are too tight for a loaded full run.

## Evidence

- `hub/test/session-native-lifecycle.test.ts` "an Implementer pool moves to the next task worktree after merge (opencode, keep_context=true)": `Error: no result for session.launch within 5000ms` (harness.ts:709). Alone five times on 2026-11-13 21:04Z under the preservation lock, it passed 5/5 in 5.9–8.0 s each. The lone run already exceeds the 5 s reply bound's margin on some machines. A sibling case (keep_context=false) failed the same way in the loaded batch 35865a52 (A-19192).
- `hub/test/suite-recovery.test.ts` "cancel removes an admitted worker's compatibility FIFO ticket without releasing a racing hand holder": `admitted worker has a legacy FIFO ticket: not within 15000 ms` (line 338), 30.9 s against a 2.0 s baseline. Alone five times at 21:03Z, it passed 5/5 in 2.1–2.8 s each.

## What to build

Each case's setup wait uses the shared `testWaitMs()` scaling, or a named bound sized for a loaded full T3 run, so a slow machine no longer reads as a product failure. Each behaviour bound the case asserts stays exact and named. The cause of each slow path under load is named on this item: launch reply latency, and FIFO ticket observation.

## Acceptance criteria

- [ ] C1. The session.launch reply wait in session-native-lifecycle and the FIFO-ticket wait in suite-recovery use scaled or named setup bounds, and every behaviour bound they assert stays exact (test).
- [ ] C2. Both files pass a full local T3 run and five lone repetitions on macOS, and their slow path under load is recorded on this item (test).

## Comments

### coord · 2026-11-13T22:48:01.523Z

Third identity of the same class: hub/test/suite-timeouts.test.ts 'verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor' failed in T-1842's local batch 08c287d6 (A-19229, 1 worker, peak load 5.26). The error was 'fast pipe holder started after snapshot: not within 15000 ms' (line 389), and the case took 18.8 s. Alone five times at 0b506cd2e (2026-11-13 22:47Z) it passed 5/5 in 8.3-10.3 s each. Even lone runs approach the 10 s T3 default.

### coord · 2026-11-14T01:16:17.930Z

Moved into R-1530 by ask 96990fef, answered 2026-11-14 01:16Z: land the test-timing fixes locally, then rerun the E-1537 stage-2 macOS cover.
