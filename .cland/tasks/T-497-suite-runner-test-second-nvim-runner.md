---
id: T-497
kind: task
title: "suite-runner test: second nvim runner misses the fixed 500 ms contention window and never reports the holder (Linux, under load)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-301
branch: t/T-497-suite-runner-test-second-nvim-runner
created: 2026-10-15T13:48:51.140Z
updated: 2026-10-15T15:23:49.163Z
---

## Problem

`hub/test/suite-runner.test.ts:76`, 'two nvim suite invocations serialize and report the holder', failed on Linux in T-393's droplet verify 282b9c70 at bedfcef3 (A-3038). The expected waiting-for-holder diagnostic didn't appear within 20 s. The case holds the first runner for a fixed 500 ms before starting the second, so under load the second runner can miss the contention window. The whole file passed 5× alone on the Mac, 250/250 (A-3043).

## Acceptance criteria

- [x] C1. The case keeps the first runner holding until the second has observably started waiting, using a gate or file signal rather than a fixed 500 ms. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
  - done: impl-497 · 2026-10-15T15:16:07.738Z
  - verified: rev-30 [reviewer] · run rev-20261015-497-source · 2026-10-15T15:17:23.945Z · commit b53da58894f1150cbf54f5df8691cdd27ac032c2
  - verified: rev-30 [reviewer] · run rev-20261015-497-delta · 2026-10-15T15:23:49.163Z · commit 9b10339a8cd82da4d7d92753e927ca30564ad2db
- [ ] C2. suite-runner.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-497 · 2026-10-15T15:07:09.330Z

Reproduced the exact missing waiting-for-holder symptom on Mac: temporarily delayed starting runner 2 by 750 ms; the unchanged nvim assertion failed in until() after ~20 s (test total 22.20 s). This pins the race to the fixed 500 ms holder window. Replacing that artificial work with a release file opened only after the existing holder PID assertion. Keeping all assertions and time bounds. Temporary delay will be removed after a green check.

### impl-497 · 2026-10-15T15:16:08.639Z

Implemented in b53da58894f1150cbf54f5df8691cdd27ac032c2. Evidence A-3102 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3102-t-497-mac-test-evidence-five-serial-whole-file-passes contains five serial whole-file Mac passes (250/250), labels and timings, and the deterministic delayed-start red/green result. Temporary delay removed; every assertion/time bound unchanged. Fetched and merged origin/dev 8389c3dd before commit/push. C2 awaits post-review Linux verify.

### rev-30 · 2026-10-15T15:17:23.945Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-497-source
commit: b53da58894f1150cbf54f5df8691cdd27ac032c2
scope: full

Source review clear at b53da58894f1150cbf54f5df8691cdd27ac032c2; no high, medium or low findings.

Standards: no findings against repo observed-state test guidance or code-review smell baseline. A release file replaces the artificial 500ms work interval; it is scoped to the existing temporary fixture and shared hub/nvim parameterization. Existing runner teardown and directory ownership remain in force.
Spec: C1 verified. suite-runner.test.ts:66–79 holds the first fixture until the second emits the existing waiting-for-holder diagnostic and the exact first-runner PID assertion succeeds, then writes the release signal. Both exit-code assertions and the exact start/end serialization journal remain unchanged. The successor observes the already-created release file, so it cannot deadlock on the first holder's gate. Existing until limits and every assertion remain. Commit body records the fixed-window root cause and removed delayed-start probe.

A-3102 records deterministic 750ms delayed-start old-red/new-green, probe removed; five serial whole-file Mac logs each show 50/50, no failures/skips/cancellations (250/250). Labels distinguish brief first-run overlap with automatic fallback from four quiet runs, permitted by E-482 1ba48602. Identical task file used before final dev integration; exact-head typecheck is pending the post-source verifier.

Reviewed git diff 8389c3dd45f92848dd43290f33f29fe1a9feed5a...b53da58894f1150cbf54f5df8691cdd27ac032c2, one commit/one file (4+/2-); git diff --check green. C2 remains unverified pending accepted same-head Linux gate. Both Standards and Spec reviewed directly; role prohibits delegation. No Reviewer tests or edits.

Criteria: C1 verified.

### rev-30 · 2026-10-15T15:23:49.163Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-497-delta
commit: 9b10339a8cd82da4d7d92753e927ca30564ad2db
scope: delta

Delta source review clear at 9b10339a8cd82da4d7d92753e927ca30564ad2db; no high, medium or low findings.

Standards: shared heartbeat duration commits are integrated with the correction: parsed manifest has the measured 5.113s allowance under allow, reason and A-3109 provenance, and no stray root key. No test assertion or budget-wide override added.
Spec: suite-runner.test.ts is byte-identical to source-reviewed b53da588; net task diff against merged dev 7df53ebe remains only the six-line holder fixture change. C1 reverified: release follows observed waiter/exact holder PID and preserves every assertion/time bound. Inherited T-495 is already final-reviewed with accepted Linux evidence; rulebook/tracker updates add no task-local seam change.

Reviewed b53da588..9b10339a and net task diff 7df53ebe...9b10339a; git diff --check green. Five Mac passes A-3102 remain supporting evidence for unchanged file. C2 awaits accepted Linux verification. Old immutable run d95c9b7a at b53da588 remains old-head evidence; await it rather than submitting overlapping verification, then request a current-head run after this clear. Both axes reviewed directly; no Reviewer tests or edits.

Criteria: C1 verified.
