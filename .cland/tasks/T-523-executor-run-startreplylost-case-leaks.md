---
id: T-523
kind: task
title: executor-run startReplyLost case leaks pipe handles past the case under load (projectHub leak check, Linux)
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-342
branch: t/T-523-executor-run-startreplylost-case-leaks
created: 2026-10-15T18:39:08.367Z
updated: 2026-10-16T01:01:48.906Z
---

## Problem

`hub/test/executor-run.test.ts:190`, the `startReplyLost` case, failed on Linux in T-508's droplet verify 263c9910 (A-3259:4028–4060). T-393's projectHub leak check reported "projectHub leaked resources; active before=CloseReq,PipeWrap,PipeWrap,PipeWrap,TCPServerWrap after=PipeWrap,PipeWrap,PipeWrap". The case loses the start reply on purpose, and a pipe from the lost exchange outlives the case under load.

## Acceptance criteria

- [ ] C1. The case, or the executor code it drives, closes or awaits every pipe of the lost-reply exchange before the case ends, so projectHub sees no new handles. Keep the leak check. Record the root cause, and whether a product path leaks too, in the commit.
  - verified: rev-30 [reviewer] · run rev-20261016-523-source · 2026-10-16T01:01:48.906Z · commit fded4fb0f26902b34872910f9168f35ddcd5ebc2
- [ ] C2. executor-run.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### coord · 2026-10-15T20:01:02.219Z

Second case of the same class: executor-prepare.test.ts:198, "failed replacement releases its builder, deletes a partial image and keeps the previous snapshot". The body assertions pass, but the projectHub cleanup (hub-resources.ts:30) detects a PROCESSWRAP leak on Linux in T-474's run fb5a0840 (A-3313). Cover both executor handle leaks.

### impl-523 · 2026-10-16T00:23:17.641Z

Read task, E-482 decisions and v0.1.3 spec. Investigating both executor lost-start-reply pipes and failed snapshot replacement PROCESSWRAP; will retain projectHub leak assertions. First gathering targeted baseline and tracing resource ownership. Coordinator requested npm ci --ignore-scripts before typecheck; doing so in this worktree.

### impl-523 · 2026-10-16T00:28:44.294Z

Original Linux receipts A-3259:4028 and A-3313:4074 both leak one PROCESSWRAP, not PIPEWRAPs. Root cause: stopWatchdog identity-checks and sends SIGTERM without awaiting child exit/close, so provider release/result may finish before native watchdog cleanup. Product path is affected as well as test teardown. Deterministic regression at existing lost-reply seam: SIGSTOP the owned watchdog, finish the suite, assert PID gone before result; old code fails true !== false (18.2 s run). Implementing bounded graceful wait + SIGKILL escalation in watchdog.ts only, retaining exact ChildProcess close receipts for owned watchdogs and identity-protected waits for restored ones. Failed replacement now asserts builder watchdogs gone too; leak checker unchanged.

### rev-30 · 2026-10-16T01:01:48.906Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-523-source
commit: fded4fb0f26902b34872910f9168f35ddcd5ebc2
scope: full

Source review T-523 clear at fded4fb0f26902b34872910f9168f35ddcd5ebc2, fixed comparison ca09b03c056fcc77015b698bc95f9bee9655df13. Standards and Spec reviewed directly. No high, medium or low findings.

C1 verified: watchdog.ts retains an exact ChildProcess close promise for watchdogs spawned by this process, keyed by PID and recorded start identity. Release's existing awaited stopWatchdog call now sends SIGTERM, awaits closure for a bounded grace period, escalates SIGKILL and separately bounds final closure; failure throws rather than claiming completion. Timers are cleared when receipts win. Child handles remain unref'ed outside a stop wait, and the map removes only the same owned entry on close, protecting replacement entries. Owned signalling uses the original ChildProcess handle. For restored watchdogs, signals retain persisted PID/start revalidation before each signal; polling accepts disappearance or a positively different start identity, not an unavailable probe, after signal admission. If an initial restored identity cannot be established, existing conservative no-signal behavior remains; this patch does not broaden process ownership. Production watchdog independence and its destruction loop are unchanged. No droplet.ts mutation-queue changes or T-517 surface edit.

Root cause is recorded in commit888c5501 and A-3496: original A-3259/A-3313 each add one PROCESSWRAP, with PipeWraps already baseline. Sending SIGTERM returned before native ChildProcess cleanup, affecting production release as well as projectHub tests. The same shared stop path covers the failed builder-replacement leak tracked also as T-549. Leak checker is retained unchanged.

Tests preserve existing assertions. startReplyLost now owns the watchdog, sends SIGSTOP and observes stopped state BEFORE releasing the finish barrier, keeps no-result/concurrency checks before release, then requires watchdog gone after the result. This deterministically forces escalation rather than depending on load. Marker-only path asserts exit too. Failed-replacement test requires each retained builder watchdog gone across snapshot/SSH/install/retirement faults, alongside existing zero-provider-resource and snapshot/journal assertions. Test-only grace500ms accelerates the controlled stop; production grace remains5s per wait.

A-3521 raw logs read: old-source deterministic startReplyLost fails PID-gone assertion (A-3509;3 total,1pass/2fail including parent summary), corrected regression3/3 (11.840s Node); first whole executor-run21/21 (102.227s), executor-prepare17/17 (64.807s), zero fail/skip. Typecheck log present; immutable whitespace check clear. Confirmed git diff2dbc45e5..reviewed-head -- hub nvim is empty, so these receipts cover unchanged product/test source despite pre-review tracker/QA-doc merge.

C2 remains pending four further serial whole-file passes of both files and the required same-head actual droplet task verification. Source clearance is not final evidence or merge readiness. Continue Coordinator's per-file admission sequence and exact-head default verification instruction; changed heads need source re-review. No per-item QA. Task file used for criteria/body under T-548 guidance; no task.view scan. No Reviewer tests, compiler/binary execution, edits, installs, signals, merges or provider actions.

Review artifact A-3522 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3522-t-523-source-clear-at-fded4fb0-await-watchdog-close-before-release-result.md.

Criteria: C1 verified.
