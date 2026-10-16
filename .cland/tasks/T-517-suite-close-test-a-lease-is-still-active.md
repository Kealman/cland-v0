---
id: T-517
kind: task
title: "suite-close test: a lease is still active right after a successful sharded result (Linux)"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-395
topic: topic-331
branch: t/T-517-suite-close-test-a-lease-is-still-active
created: 2026-10-15T17:18:57.301Z
updated: 2026-10-16T01:16:09.670Z
---

## Problem

`hub/test/suite-close.test.ts:82` expects the executor's leases to be `[]` after a successful sharded result. On Linux, in T-394's droplet verify 8970a57f (A-3204, peak load 12.6), one lease and its watchdog were still active when the test looked. Either the lease release completes after the result is reported, so the test reads too early, or the release is genuinely late. A late release would matter for spend and the `cland` tag listing. It's T-395's file, so it's rework of T-395.

## Acceptance criteria

- [x] C1. The product race is fixed: reconcile revalidates the current lease and watchdog after its asynchronous liveness probe, under a per-lease mutation queue shared with release, so a completed release is never resurrected as active (A-3407); a deterministic executor regression that fails on the old code proves it, and suite-close assertions stay unchanged.
  - verified: rev-30 [reviewer] · run rev-20261015-517-source · 2026-10-15T23:41:48.406Z · commit f7e0c0313d1b9a4e5d145a2858accf1f3dbc7a8a
  - done: impl-517 · 2026-10-15T23:43:27.817Z
- [ ] C2. suite-close.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-517 · 2026-10-15T22:31:53.402Z

C1 diagnosis: product race, not a read-too-early assertion. Suites already awaits confirmed DropletExecutor.release() for every shard before publishing the merged result. reconcile() could hold an old active lease across a watchdog liveness/startup await, then rearm/save it after release had persisted released and stopped the old watchdog. A deterministic public executor regression held replacement startup across a completed release and reproduced A-3204 exactly on unchanged product code: active lease + watchdogAlive:true, while provider droplets/keys were empty (1.03s). Fix revalidates the current lease/watchdog under a per-lease mutation queue shared with release's transition to releasing, preserving released ownership and stopping an unused replacement. suite-close assertions remain unchanged.

### impl-517 · 2026-10-15T23:39:47.660Z

Implementation committed/pushed at f7e0c0313d1b9a4e5d145a2858accf1f3dbc7a8a after fetching/fast-forwarding origin/dev (c30b2666); that update touched none of the five required executor/close files. C1 product fix: per-lease mutation queue serializes release's transition to releasing with reconciliation's reread/check/save; a changed state or watchdog discards/stops the unused replacement. suite-close assertions unchanged. Deterministic original-code red: A-3407. Quiet Mac validation logs: A-3461 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3461-t-517-quiet-mac-validation-logs). suite-close whole-file 5/5: 35/35 cases in 30.94, 30.88, 33.23, 33.20, 34.04s; executor-droplet 14/14 including final repeat in 10-executor-droplet-final.log (regression 1.067s); executor-safety 20/20; suite-close-recovery 5/5; executor-run 21/21. Queue local:none and load 2.08–3.82 at admissions. Hub typecheck and diff check passed. New regression is below 5s and needs no duration exception. Initial full-file attempt exposed a test after-hook ordering error, corrected using onCleanup before directory removal; final complete file is green. C2 Linux evidence remains pending post-source-review verification.

### rev-30 · 2026-10-15T23:41:48.406Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-517-source
commit: f7e0c0313d1b9a4e5d145a2858accf1f3dbc7a8a
scope: full

Source review T-517 clear at f7e0c0313d1b9a4e5d145a2858accf1f3dbc7a8a, parent dev c30b2666a6d07be66053f930bafb6032361510ea. Standards and Spec reviewed directly under the no-delegation role. No high, medium or low findings.

C1 verified by source and deterministic regression evidence A-3407. The bug is stale product recovery, not an early suite-close assertion: reconcile can read active, await watchdog liveness/startup, then overwrite a completed release with that old snapshot. The new per-lease promise queue (:73–79) serializes release's persisted reread/identity-check/transition to releasing (:251–259) with recovery's current reread/check/write (:340–352). Probes/startup stay outside the queue. Once release transitions, a queued recovery sees releasing/released and cannot rearm; if recovery commits first, release rereads its winning watchdog before cleanup. A changed watchdog PID/start identity also rejects the old recovery. Discarded replacement is passed explicitly to identity-checked stopWatchdog, leaving the winning watchdog untouched. Queue entries are removed only if still the current work, and failed work does not poison later mutations.

Existing release deduplication, confirmed provider deletion/accounting and terminal released persistence remain. Reconcile does not arm a releasing lease. No suites.ts/run.ts or suite-close assertion changed; immutable diff confirms only droplet.ts and executor-droplet.test.ts.

Regression source uses public acquire/reconcile/release/inspect with fake provider and real local OS boundaries. A fixture-local ps wrapper holds only replacement watchdog identity startup, while the old watchdog's liveness/release path proceeds. It proves replacement alive, confirmed release cost, empty droplets/keys and a nonexpired barrier BEFORE resuming reconcile. Afterwards it requires no visible lease and observes replacement exit. The 2.5-second fail-closed barrier sits below the production3-second probe timeout and explicitly fails if the held window expires, preventing a vacuous pass. A-3407 records original-code red active+watchdogAlive after deletion; corrected final whole-file log records regression1.067s. onCleanup unblocks/joins reconcile and idempotently releases before fixture directory removal; ownProcess records both watchdogs.

Standards: small file-local mutation seam centralizes the indivisible ownership transition rather than wrapping provider/network waits. No production timeout widening, relaxed close assertion, private-method mock or new global environment mutation. Existing machine-file classification applies; new test measured below5s and needs no allowance. Diff check clear; hub typecheck reported green. This pass reviews the requested single-executor ownership race, not a claim of a new cross-process locking protocol.

C2 remains UNVERIFIED until required actual droplet suite-close file evidence and acceptable overall gate. A-3461 supports the Mac portion: five complete serial whole-file suite-close7/7 runs (35 cases), zero failures/cancellations/skips, raw Node wall30.913/30.850/33.202/33.172/34.009s (receipt command walls30.939/30.878/33.231/33.199/34.040). Final executor-droplet file14/14, executor-safety20/20, suite-close-recovery5/5, executor-run21/21 all complete green. The initial after-hook ordering issue was disclosed and corrected; final 10-executor-droplet-final.log confirms complete corrected cleanup. Validation script contains serial queue/load/targeted-process guards; Implementer reports quiet local:none, admission load2.08–3.82. Pre-review dev update touched none of those five source files.

One exact-head no-mode task verification may follow source clearance under current Coordinator admission rules. Preserve actual executor/platform; C2 explicitly needs a droplet file pass. No per-item QA criteria. No Reviewer tests, compiler/binary execution, edits, signals, merges or provider actions.

Evidence A-3407 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3407-t-517-deterministic-red-and-root-cause.md; A-3461 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3461-t-517-quiet-mac-validation-logs/receipts.json with adjacent complete logs and validation script.

Review artifact A-3464 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3464-t-517-source-clear-at-f7e0c031-serialized-lease-ownership-prevents-recovery-resu.md.

Criteria: C1 verified.
