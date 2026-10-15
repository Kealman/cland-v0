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
updated: 2026-10-15T19:22:00.568Z
---

## Problem

`hub/test/suite-close-recovery.test.ts:54`, T-395's lost-machine case, expects `/shard-1: remote machine lost/`. In T-456's droplet verify ae7c7a40 (A-3082:3993–4018) on Linux, both shards passed with exit 0 instead. The fake machine loss apparently lands after shard 1 has already finished, so the test races its own fault injection. This is T-395's new test, so it's rework of T-395.

## Acceptance criteria

- [x] C1. The fault is injected at an observed point where shard 1 is still running, using a gate in the fake executor rather than wall-clock timing, so the case always exercises the lost-machine path. Every assertion stays, and the root cause is recorded in the commit.
  - done: impl-502 · 2026-10-15T19:19:37.828Z
  - verified: rev-30 [reviewer] · run rev-20261015-502-source · 2026-10-15T19:22:00.568Z · commit 5932d8a6abdf4ec46f9ce0e93e21bbfe2f8d5d55
- [ ] C2. suite-close-recovery.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

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
