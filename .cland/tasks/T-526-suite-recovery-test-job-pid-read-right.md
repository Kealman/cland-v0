---
id: T-526
kind: task
title: "suite tests: a worker's job.pid read right after launch is still null under load (suite-recovery, suite SIGKILL)"
state: open
status: review
size: XS
rank: 4401
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-405
branch: t/T-526-suite-recovery-test-job-pid-read-right
created: 2026-10-15T19:50:58.056Z
updated: 2026-10-16T19:13:53.554Z
---

## Problem

Two suite tests read a worker's `job.pid` right after launch, and under load on Linux it's still null. The worker pid is published asynchronously, after admission.

- `hub/test/suite-recovery.test.ts:158`, 'cancel removes an admitted worker's compatibility FIFO ticket without releasing a racing hand holder'. It failed in T-502's droplet verify f23a4f38 (A-3310:4109–4126).
- `hub/test/suite.test.ts`, 'suite worker SIGKILL produces one crash result with its log', with `TypeError [ERR_INVALID_ARG_TYPE]: The "pid" argument must be of type number. Received null`. It failed in T-635's run 8130ab79 (A-4045) and T-621's run 2a0b0a78 (A-4130). The hub flagged it as a shared defect on 2026-10-16.

## Acceptance criteria

- [x] C1. Both cases wait for the observed worker pid, with a bounded wait on the job record, before using or asserting on it. Every assertion stays, the root cause is recorded in the commit, and a shared helper is used if one fits both.
  - done: impl-526 · 2026-10-16T19:10:22.327Z
  - verified: rev-30 [reviewer] · run rev-20261016-526-source · 2026-10-16T19:13:34.264Z · commit aeaf3dec05633330639c0c3258615c6a47b50f4b
- [ ] C2. suite-recovery.test.ts and suite.test.ts each pass 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-526 · 2026-10-16T19:07:53.375Z

Implementing the assigned shared defect fix for both PID publication races. Will use a shared bounded job-record observer, retain launch's asynchronous behavior for tests asserting queued admission, and record 5 serial whole-file Mac passes per file before review.

### impl-526 · 2026-10-16T19:12:35.514Z

Implemented and pushed aeaf3dec05633330639c0c3258615c6a47b50f4b. Shared fixture.workerPid(id) polls hub.status's matching job record with the existing bounded eventually helper, owns the observed worker for cleanup, and supplies both cancellation and SIGKILL cases; every prior assertion remains. Root cause is recorded in commit body. npm run typecheck passed at this head (A-4137). Both suite-recovery.test.ts (6 tests) and suite.test.ts (11 tests) passed 5/5 serial whole-file runs on macOS, one file invocation at a time, with pre-run 1m load 4.28–6.70 (<15). No failures/skips; C2's droplet part remains pending source review and verify.

### rev-30 · 2026-10-16T19:13:34.264Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-526-source
commit: aeaf3dec05633330639c0c3258615c6a47b50f4b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-526 full source review clear at aeaf3dec05633330639c0c3258615c6a47b50f4b. Fixed point a446efc5244748bd1b2bb8b32bb78a1589049b6f (merge-base and direct parent). Diff command: git diff a446efc5244748bd1b2bb8b32bb78a1589049b6f...aeaf3dec05633330639c0c3258615c6a47b50f4b. One task commit, test-only three-file scope. Both axes reviewed in-session under this role's no-delegation constraint.

Standards: no findings. Shared suite-fixture workerPid(id) reads hub.status through the real UI socket and finds the current matching suite id; nullable or absent PID becomes undefined for the established eventually helper. That helper has the configured testWaitMs deadline and polling interval. Successful observation registers PID ownership with ownProcess before returning, preserving cleanup on later assertion failure. No fixed startup sleeps, production changes or new test identities/budget exemptions. Independent diff whitespace check passes; no additional CODING_STANDARDS.md or CONTRIBUTING.md found.

Spec: no findings. The FIFO cancellation case now waits for published PID before asserting it and observing the exact worker barrier; it still verifies cancellation exit, recipients, empty FIFO, dead worker, racing hand-holder directory, no admitted package marker and exactly one report. The SIGKILL case observes matching PID separately before its package-start receipt, then kills that exact worker and retains crash-report/log assertions. No assertion is removed. Commit body explicitly records launch acknowledgement before asynchronous admission/PID publication, immutable response snapshot, and why a later log/barrier cannot refresh that snapshot. C1 established.

C2 local evidence audited: A-4138 has suite-recovery 6/6 in each of five serial whole-file runs and suite 11/11 in each of five runs: 85 passes, zero failures/skips. Reported per-file admission loads 4.28–6.70, all below 15. A-4137 contains root typecheck output and claimant reports exit 0 at this committed head. Reviewer ran no tests/compiler. C2 remains unverified pending normal exact-head droplet task receipt containing both whole files; Mac evidence alone is not final clearance. No per-item QA criteria.

A separate pre-existing stale launch-PID use in the borrowed-root recovery case is reported to the lead as an aside, not a missing requirement in the two named C1 cases.
Review artifact A-4139.

Criteria: C1 verified.

### impl-526 · 2026-10-16T19:13:53.554Z

Source review clear at aeaf3dec (rev-20261016-526-source, A-4139), C1 verified. Exact-head explicit droplet verification submitted as e90a4fd5-e439-46f0-bdbe-45b8575ed314, queue position 1. C2 awaits its Linux result. Reviewer aside (Bugs/XS) for the analogous planned-root crash case at suite-recovery.test.ts:129 reported to lead T-526 for classification; no change to reviewed head.
