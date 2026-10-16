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
updated: 2026-10-16T01:50:12.940Z
---

## Problem

`hub/test/suite-close.test.ts:82` expects the executor's leases to be `[]` after a successful sharded result. On Linux, in T-394's droplet verify 8970a57f (A-3204, peak load 12.6), one lease and its watchdog were still active when the test looked. Either the lease release completes after the result is reported, so the test reads too early, or the release is genuinely late. A late release would matter for spend and the `cland` tag listing. It's T-395's file, so it's rework of T-395.

## Acceptance criteria

- [x] C1. The product race is fixed: reconcile revalidates the current lease and watchdog after its asynchronous liveness probe, under a per-lease mutation queue shared with release, so a completed release is never resurrected as active (A-3407); a deterministic executor regression that fails on the old code proves it, and suite-close assertions stay unchanged.
  - verified: rev-30 [reviewer] · run rev-20261015-517-source · 2026-10-15T23:41:48.406Z · commit f7e0c0313d1b9a4e5d145a2858accf1f3dbc7a8a
  - done: impl-517 · 2026-10-15T23:43:27.817Z
  - verified: rev-30 [reviewer] · run rev-20261016-517-manifest-delta · 2026-10-16T01:23:43.411Z · commit 0e2301e7eb738fd4e7d1366e5ac7b1004f31659a
  - verified: rev-30 [reviewer] · run rev-20261016-517-repetition-correction · 2026-10-16T01:50:12.940Z · commit d7fc7424e07571e1f4da90abd0ca2da3d86b5fa8
- [x] C2. suite-close.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-517 · 2026-10-16T01:18:40.164Z

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

### rev-30 · 2026-10-16T01:23:43.411Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-517-manifest-delta
commit: 0e2301e7eb738fd4e7d1366e5ac7b1004f31659a
scope: delta

Delta source review T-517 clear at 0e2301e7eb738fd4e7d1366e5ac7b1004f31659a, direct parent/source-reviewed f7e0c0313d1b9a4e5d145a2858accf1f3dbc7a8a. Standards: no findings. Spec: no findings in this data-only delta.

Independent immutable audit: only hub/test/durations.json changes. Conflict resolution matches Coordinator-posted2149fe33d178b5ef93d2742151d7290026dc2d8e byte for byte. Strict JSON parsing rejects duplicate keys; root keys remain version/source/budget/files/tests/allow. All non-allow fields equal the posted payload, including2177 baseline test identities; all229 shared allowance keys and values/reasons remain, with zero drops or changed common values. No extra task allowances. No production code, test cases, bounds or dependencies changed; no dev merge. Immutable diff whitespace checks clear.

Shared evidence A-3493/c0c04df1 is the full integrated cover at a06020a3478184c604165d70d0d0e81b30a956a7, exit0, hub and Neovim completed. It supports this Coordinator-directed baseline refresh; it is not a task-head verification. No additional local rerun requested for this shared data-only pick under launch rules.

A-3541 remains exit124 at50m, with ordinary own regression0.973s/suite-close green but its own repeated load gate stalled until timeout. A-3487 green Mac and source A-3464 remain support, not final C2. Coordinator50223849 explicitly requires exact single-case repetition-path probe after T-556 slot and correction preserving assertions before another droplet. This data-only clearance does not establish the hang fixed or authorize skipping that diagnosis; any test fix needs source review.

Only source-established criteria C1 reverified here. No final evidence/merge readiness claimed. Any subsequent source/head change needs delta review; verification follows the lead's stated prerequisites/admission sequence. No per-item QA change. Read task files/earlier review chain; no task.view full-journal scan. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Review artifact A-3555 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3555-t-517-shared-manifest-delta-clear-at-0e2301e7.md.

Criteria: C1 verified.

### impl-517 · 2026-10-16T01:48:56.957Z

After A-3541's Linux load-gate stall, exact bootstrap + anchored-name + custom-reporter Mac probe reproduced the standalone failure/hang (A-3573). Diagnostic capture found armWatchdog's 'could not verify ... process identity': the blocked ps sampled only after release, while a replacement whose first lease read occurred after release legitimately exited. A rejected reconciliation also caused the managed hook to throw before the separate native API-close hook, leaving a listening API and hanging the process. Fixed only the test in d7fc7424e07571e1f4da90abd0ca2da3d86b5fa8: sample the real ps identity before holding its reply; keep provider close in managed try/finally and release in reconciliation cleanup's finally. Every ownership/concurrency/barrier/process-exit assertion remains. Product source unchanged from source-clear f7e0c031; posted manifest 2149fe33 remains exact at parent 0e2301e7. Evidence A-3577: original failure cause diagnose-20.log; corrected original gate reporter exact repetitions fixed-exact-five.log 5/5; additional fixed diagnostic batch 8/8 before an admission guard pause; corrected harness against original product fails promptly at the lease assertion with exit1/no outer timeout; final whole-file 14/14 in final-whole-file.log. Gate checks exclude only local-holder workers by cwd, loads 2.61–3.75 beside local T-488. Hub typecheck/diff check passed. New source delta review requested before another droplet.

### rev-30 · 2026-10-16T01:50:12.940Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-517-repetition-correction
commit: d7fc7424e07571e1f4da90abd0ca2da3d86b5fa8
scope: delta

Delta source review T-517 clear at d7fc7424e07571e1f4da90abd0ca2da3d86b5fa8, direct parent/source-clear0e2301e7eb738fd4e7d1366e5ac7b1004f31659a. Standards: no findings. Spec: no high, medium or low findings in the test correction.

Immutable audit: only hub/test/executor-droplet.test.ts changes,9 insertions/5 deletions. Product lease mutation queue/revalidation and exact approved2149fe33 manifest are unchanged. Whitespace check clear. No product redesign or assertion/bound removal.

The injected ps shim now samples the real /bin/ps result before holding the replacement identity response. The prior ordering allowed release to persist the released lease before the replacement watchdog's first lease read; the child could legitimately exit while the shim waited, causing a later real ps query to return no identity. Sampling first holds a valid observed response at the intended asynchronous boundary. The test still observes the old watchdog gone and replacement alive, completes release while the response is held, asserts provider droplets/keys empty and the2.5s barrier unexpired (below production3s probe bound), then resumes reconciliation, asserts no active lease and observes unused replacement exit. It therefore still exercises publication after a completed release, rather than substituting an unconstrained sleep or weakening lifecycle observations.

Cleanup is registered immediately after fake API creation through onCleanup. Its finally closes the API even if reconciliation/release rejects; the managed cleanup runner preserves subsequent directory/check cleanup. finish is installed after acquire and upgraded when reconciliation starts. After barrier release it awaits reconciliation but attempts lease release in finally even on a reconciliation rejection. This resolves the native after-hook skip/retained fake API handle behind the observed hang, while retaining failure reporting.

Read raw A-3573/A-3577 receipts. Before correction, repeated exact standalone path intermittently fails identity observation and reaches the outer20s process deadline; diagnose-20 records the armWatchdog identity error. Corrected fixed-exact-five uses original hub/test/load-gate-reporter.ts, exact anchored name, gate bootstrap, fresh child process and15s test/20s outer bounds:5/5, each exit0 with exactly one matching passing case. Additional diagnostic corrected8/8 precedes an admission pause and is supporting evidence only, not a completed20-run claim. final-whole-file is14/14, zero failures, exit0. Crucially corrected-harness-old-product-red exits1 promptly at the unchanged deep-equality empty-lease assertion (line385), with no hang; original product therefore remains rejected by the corrected test. Implementer reports typecheck green. Reviewer executed no tests/compiler/binaries.

C1 source/regression proof reverified at this head. Historical suite-close five serial Mac passes and A-3541 ordinary Linux suite-close pass remain supporting file evidence, but A-3541 overall exit124 and incomplete own load gate are not an admissible final green. C2/final evidence settlement remains pending the Coordinator-directed fresh actual Linux verification at this corrected reviewed head. No further local repetition requested here; submit according to current Coordinator admission/shared-fix rules. Any additional head change needs delta review. No per-item QA change.

Read tracker file under overload guidance, no task.view scan. No edits, signals, installs, commits, merges, provider actions or subagents by Reviewer.

Review artifact A-3580 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3580-t-517-repetition-path-correction-source-clear-at-d7fc7424.md

Criteria: C1 verified.
