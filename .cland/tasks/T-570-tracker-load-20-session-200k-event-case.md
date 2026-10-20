---
id: T-570
kind: task
title: tracker-load 20-session, 200k-event case passes only 4/5 under the load gate on a droplet
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: E-952
blocked_by: []
regression_of: T-548
topic: topic-722
branch: t/T-570-tracker-load-20-session-200k-event-case
created: 2026-10-16T04:34:57.365Z
updated: 2026-10-20T10:00:35.940Z
closed: 2026-10-20T10:00:35.940Z
---

## Summary
T-548's new hub/test/tracker-load.test.ts case for 20 sessions and 200,000 events passed 5/5 under the load gate in T-548's own run f4fb4357 (A-3657). In T-296's droplet run c1acaff2 at 16d819bc (A-3703), on a different branch, the gate saw it pass only 4/5. T-296 doesn't touch the tracker or journal. Until the next stage-close durations refresh, the case counts as new, so the load gate repeats it in every task verify.

## Acceptance criteria
- [x] C1. Find which bound fails on the failing repetition (the 5 s request budget, the fixture's setup time or a timeout), and make the case stable under droplet load without loosening the 5 s request bound it exists to prove; record the cause on this item.
  - verified: rev-31 [reviewer] · run rev-20261020-570-source · 2026-10-20T09:47:03.465Z · commit 95153ce667779a74813c57db9dfbf6d99479f7be
  - verified: rev-31 [reviewer] · run rev-20261020-570-final · 2026-10-20T09:53:43.033Z · commit 95153ce667779a74813c57db9dfbf6d99479f7be
  - done: impl-570 · 2026-10-20T09:54:05.583Z
- [x] C2. The file passes 10/10 serial whole-file runs on the Mac, started on an empty verify queue; its T4 Linux evidence is the next stage cover's run (task verify excludes T4 under D53).
  - verified: rev-31 [reviewer] · run rev-20261020-570-final · 2026-10-20T09:53:43.033Z · commit 95153ce667779a74813c57db9dfbf6d99479f7be
  - done: impl-570 · 2026-10-20T09:54:06.397Z

## Comments

### coord · 2026-10-16T13:23:27.286Z

Recurred in the v0.1.3 release run 7d9819c9 at 4fb70e6e, shard-1 (A-3916, Linux c-8): tracker-load.test.ts:12 "tracker requests stay within 5 s with 20 sessions and 200000 retained events" failed at 4.90 s. The error was `database is not open` from Store.roleOf (store.ts:549), reached through publishUsage from a test timer (line 43). That points to a teardown race, a usage timer still publishing after the store closed, as much as to timing. The flaky-rule resubmit b663c7dd runs at 098e6f5a.

### coord · 2026-10-16T13:23:47.564Z

Correction from QA (qa-27, run qa-2026-10-16-27-24): in A-3916 the 5 s request bound held. The request maxima were task.view 2084 ms and task.criterion 2004 ms, and 4.90 s was the whole test's duration. The failure was only `database is not open` (ERR_INVALID_STATE) from the test's publishUsage timer at line 43, firing after the Store closed. Cause for C1: a teardown race in the test, not request latency.

### impl-570 · 2026-10-20T09:43:12.914Z

Read A-7125's T-570 row and the existing A-3916 failure evidence: `publishUsage` → `Store.roleOf` reports database is not open after hub shutdown; task.view/task.criterion maxima were 2084/2004 ms. This is fixture teardown order, not a failing request bound. Reusing that established reproduction/diagnosis rather than adding instrumentation or a new regression test for a cleanup-only change. Move clearInterval into the first cleanup hook before hub.close(), with the timer handle declared before cleanup registration so early setup failure also remains safe. Will run 10 serial whole-file Mac repetitions and seek source review, then mode-free task verify. C2's historical T4 droplet load-gate wording has been escalated to the supervising lead for reconciliation with current verification policy.

### impl-570 · 2026-10-20T09:44:27.348Z

Implemented in 95153ce667779a74813c57db9dfbf6d99479f7be: clearInterval first in the ordered cleanup hook, then hub.close/tracker.stop/journal.close. Optional handle declared before registration preserves cleanup on setup failures. Cause: the prior second t.after left publishUsage running after hub.close closed Store; the 5 s request budget itself held. A-7263 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7263-t-570-mac-targeted-tracker-load-10-serial-whole-file-passes.log) proves 10/10 serial whole-file Mac passes (20/20 tests), sampled 1m load 6.34–7.93; max observed request 1543.22 ms. Hub typecheck and diff whitespace check pass. No new test seam needed for this cleanup-only correction. C2 remains pending the lead's reconciliation of obsolete droplet load repetitions for T4.

### impl-570 · 2026-10-20T09:44:48.907Z

C2 reconciled by Coordinator decision b2988477-4e07-4c22-aa64-69f0ae4d42d5. Before the 10 Mac serial file runs, `node hub/bin/cland.ts verify queue` returned `local: none` and `local fallback: false`; uptime load was 4.19. A-7263 supplies 10/10 passes. The next stage cover owns T4 Linux evidence. No separate droplet proof needed for this task; same-head mode-free verification follows source review.

### rev-31 · 2026-10-20T09:47:03.465Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-570-source
commit: 95153ce667779a74813c57db9dfbf6d99479f7be
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7275: source clear. Optional timer cleared before first hub.close await; removed late timer hook, unchanged workload and <5000ms assertion. C1 documented teardown cause fixed. A-7263 ten serial full-file 2/2 +exit0 receipts read; source/admission attribution and load samples qualified. Coordinator b2988477 amended C2: next stage supplies T4 Linux, no separate task proof. C2 final settlement awaits same-head gate; no T4 execution claimed.

Criteria: C1 verified.

### impl-570 · 2026-10-20T09:50:17.756Z

Same-reviewed-head mode-free verification f6756241-9aea-4ea4-8395-598e9fad1355 passed at 95153ce667779a74813c57db9dfbf6d99479f7be: 570 tests/pass, 0 fail/cancel/skip; T1/T2 exit 0; evidence A-7290 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7290-suite-f6756241-9aea-4ea4-8395-598e9fad1355-auto-at-95153ce.log). Executor Linux x64 droplet c-8 lon1, lifetime 111 s, cost $0.0077. Coverage selection A-7259; tracker-load is T4 so this receipt is task regression evidence, not T4 execution. Mac T4 10/10 evidence remains A-7263 with admission/source limitations captured in A-7278; next stage cover supplies T4 Linux evidence under updated C2. Awaiting Reviewer's final settlement.

### rev-31 · 2026-10-20T09:53:43.033Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-570-final
commit: 95153ce667779a74813c57db9dfbf6d99479f7be
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7293: final evidence clear. A-7263 establishes ten serial Mac whole-file passes (20/20 tests, ten explicit exit 0 receipts); A-7278 retains the empty pre-run queue excerpt and explicit pre-commit working-tree attribution limit. Exact-head f6756241/A-7290 passes host/T1/selected T2, 570/570 with no resource/duration failures. C1's teardown fix and unchanged 5 s request bound remain established by A-7275. C2 follows Coordinator decision b2988477: task gate excludes T4 and next stage cover supplies Linux T4 landing evidence; no Linux T4 execution is claimed here.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T10:00:35.940Z

Merged 359b99097d87d69d8fe938f91e884dd663bedc0d onto dev.
