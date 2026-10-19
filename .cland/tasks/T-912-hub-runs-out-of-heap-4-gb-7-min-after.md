---
id: T-912
kind: task
title: "Hub runs out of heap (4 GB) 7 min after restart #22: readFile + split over large suite logs"
state: open
status: review
size: M
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-885
found_by: human
topic: topic-655
branch: t/T-912-hub-runs-out-of-heap-4-gb-7-min-after
created: 2026-10-19T21:47:49.515Z
updated: 2026-10-19T21:52:00.874Z
---

## Summary

Hub pid 71220 died at 21:43:34Z on 2026-10-19 with "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory" (rc 134, heap 4087 MB, node's default limit), 7.5 min after restart #22 brought T-667, T-717, T-885, T-893, T-906 and T-908 live. The native stack in `.cland/log/hub.log`, just before "hub serve exited rc=134 at 21:43:34Z", is Runtime_StringSplit ← StringPrototypeSplit ← AsyncFunctionAwaitResolveClosure ← FileHandle::ClosePromise. That's an `await readFile(...)` followed by `.split('\n')` on a large string. The replacement hub sits at about 1.1 GB RSS right after startup.

## What to build

- Find the readFile-and-split path that exhausts the heap, and confirm it with a heap measurement. The prime suspect is the load-proof backfill in `hub/src/hub/suites.ts`, around line 599: `loadProofIdentities(await readFile(artifact?.path ?? job.log))` over retained receipts, whose logs run 15–20 MB each. Check whether `job.loadProofs` actually persists through `#save`, and whether concurrent callers run the backfill loop in parallel. Also check T-667's output tail (`output.split('\n').slice(-20)`) and T-717's per-tier output handling.
- Fix it so the hub never holds more than one suite log in memory for this purpose. Stream it line by line, or read a bounded tail, and persist the result once so it isn't recomputed on every call. Concurrent calls share one in-flight computation.
- A regression test fails on the current code: many retained receipts with multi-MB logs, several concurrent callers, and a bounded heap or a counted readFile.

## Acceptance criteria

- [x] C1. The report names the culprit path, with evidence: a heap snapshot, a counter or a reproduction.
  - done: impl-912 · 2026-10-19T21:50:56.568Z
  - verified: rev-30 [reviewer] · run rev-20261019-912-source · 2026-10-19T21:52:00.874Z · commit 14e86be2a6fed798bcfe9d801da737d28a28f4cf
- [x] C2. A T2 regression test fails before the fix and passes after: concurrent callers over many large receipt logs read each log at most once, and the persisted proofs are reused across calls and hub restarts.
  - done: impl-912 · 2026-10-19T21:50:57.166Z
- [x] C3. The load-proof backfill streams each log line by line, shares one in-flight backfill between concurrent callers, and reuses persisted proofs; the report lists every other whole-log read in the hub (stage baseline, completion reporting, receipt(), dispatch reporting, shard aggregation) with its trigger and size bound, for the Coordinator to file separately.
  - done: impl-912 · 2026-10-19T21:50:58.000Z
  - verified: rev-30 [reviewer] · run rev-20261019-912-source · 2026-10-19T21:52:00.874Z · commit 14e86be2a6fed798bcfe9d801da737d28a28f4cf

## Comments

### impl-912 · 2026-10-19T21:49:24.106Z

Confirmed #landedTaskIdentities readFile → loadProofIdentities → String.split path with an eight-log (2 MiB each), six-admission fixture: 48 whole-file reads (six per log). #save persists loadProofs; overlapping admissions duplicate the reads before the checkpoint. Regression seam is public Suites.start admission, real retained files, executor receipts in-process; reopened store proves persistence. Coordinator narrowed C3 to an audit of other whole-log readers, without changing them in this urgent fix.

### rev-30 · 2026-10-19T21:52:00.874Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-912-source
commit: 14e86be2a6fed798bcfe9d801da737d28a28f4cf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6746. Sequential readline streaming retains proof identities; shared in-flight promise coalesces concurrent admissions and clears on settlement; existing per-job save/restore persists arrays across restarts. Landing eligibility and exact 5/5 parser retained. T2 regression counts whole reads/streams over eight 2 MiB logs and six public admissions, verifies all identities and no rereads after actual store reopen. C1 verified from A-6744's counted reproduction report, qualified as reported I/O evidence rather than independently raw-audited heap measurement. C3 implementation and source-cross-checked remaining-reader inventory verified; Coordinator explicitly narrowed scope and filed T-913. C2 awaits exact-head mode-free green plus actual new regression load receipts with no owned budget/resource trips. QA none; no Reviewer tests.

Criteria: C1 verified, C3 verified.
