---
id: T-555
kind: task
title: "suite-timeouts test: 'one cleanup warning' not seen within 15000 ms under load (Mac)"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
topic: topic-381
branch: t/T-555-suite-timeouts-test-one-cleanup-warning
created: 2026-10-16T01:06:48.258Z
updated: 2026-10-16T16:02:49.786Z
closed: 2026-10-16T16:02:49.786Z
---

## Summary
In T-533's local verify bbfee74e at 77659eb0 (2026-10-16 ~01:05Z, Mac, peak load about 15–20; log A-3523), `hub/test/suite-timeouts.test.ts:179` failed with "one cleanup warning: not within 15000 ms". T-533 doesn't touch the file. No E-482 ticket names this case yet.

## Acceptance criteria
- [x] C1. The case waits on the cleanup warning's own receipt, not a fixed 15 s window shared with slow teardown, or records why 15 s is the contract. The root cause goes in the commit, and every assertion stays.
  - done: impl-555 · 2026-10-16T15:55:17.781Z
  - verified: rev-31 [reviewer] · run rev-20261016-555-source · 2026-10-16T15:56:05.235Z · commit 27b5325f80c231412983a72e314ba8840f44e859
- [x] C2. suite-timeouts.test.ts passes 5/5 serially as a whole file on the Mac, plus once on a droplet in the task's verify.
  - done: impl-555 · 2026-10-16T16:01:02.127Z
  - verified: rev-31 [reviewer] · run rev-20261016-555-final · 2026-10-16T16:02:22.191Z · commit 27b5325f80c231412983a72e314ba8840f44e859

## Comments

### impl-555 · 2026-10-16T15:49:58.224Z

Diagnosis: the 15s `one cleanup warning` wait begins at the child PID marker, before the 3s silence watchdog, verified process termination, compatibility lease cleanup, durable worker result.json and hub reconciliation. There is no 15s end-to-end warning contract. Baseline whole file passed 7/7 in 34.95s (Mac). A temporary 16s pre-receipt delay restricted to cleanup-incomplete outcomes reproduced exactly `one cleanup warning: not within 15000 ms` (exit 1, 17.63s). Minimal fix observes the worker's result.json with a separate bounded 30s condition before the original warning receipt wait; every existing assertion remains. Testing the same delayed outcome next; temporary worker instrumentation will be removed.

### impl-555 · 2026-10-16T15:51:07.751Z

Committed 27b5325f80c231412983a72e314ba8840f44e859 after fetching/merging origin/dev (af78bc39). Root cause is recorded in the commit. Four added test lines only; every existing assertion and warning timeout stays. The identical 16s pre-receipt delay that failed the old test passes fixed (1/1, exit 0, 25.69s), and temporary worker probe is removed. Diagnosis evidence A-3931: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3931-t-555-diagnosis-and-deterministic-delay-probe.md. `npm run typecheck` at this head: exit 0. Whole-file Mac 10-run serial proof is underway. No new/renamed test, so no new duration allowance is needed.

### rev-31 · 2026-10-16T15:56:05.235Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-555-source
commit: 27b5325f80c231412983a72e314ba8840f44e859
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Four added lines observe exact job result.json with separate30s bound before unchanged warning receipt wait. Worker source confirms final receipt is atomically renamed after process/compatibility cleanup, so this establishes completed producer boundary. Every existing warning/mute/inbox/successor/preserved-process/outcome/journal/exactly-once assertion retained; no production/newtest/broad timeout edit. A-3931 same16s pre-receipt delay reproduces exact old15s warning failure then passes fixed; probes absent, cause recorded in commit/item. C1 verified per rules9/10. Exact-head typecheck reportedgreen, independent diffcheck/ref clear. C2 pending durable completed Mac serial proof (launch10/10, request5/5 so far) plus fresh exact-head Linux task run. No per-item QA. Analysis A-3941: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3941-t-555-source-clear-separate-worker-completion-and-warning-waits.md. No Reviewer edits/tests.

Criteria: C1 verified.

### impl-555 · 2026-10-16T15:58:39.081Z

Mac serial proof COMPLETE at reviewed head 27b5325f80c231412983a72e314ba8840f44e859: whole hub/test/suite-timeouts.test.ts passed 10/10 serially, 7/7 tests each (70/70), all exit 0. Durations: 38.674, 41.425, 41.864, 47.401, 48.393, 44.108, 41.244, 46.970, 42.672, 41.831 seconds. Total 434.582 seconds. Durable full logs, machine identity, summary, typecheck exit-0 log and delay probe logs: A-3947 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3947-t-555-mac-10-of-10-serial-proof-and-typecheck-logs (entry summary.json). Source review rev-20261016-555-source is clear with C1 verified. Submitted no-mode cland verify at this exact unchanged head; Linux receipt remains pending for C2.

### impl-555 · 2026-10-16T16:01:03.037Z

C2 complete: same-reviewed-head Linux droplet verification face52c0-685a-40ff-b087-d861caf86c6e passed exit 0 at 27b5325f80c231412983a72e314ba8840f44e859. Selected target file plus hub/Neovim smoke: 41/41 tests, zero failures; target cleanup-warning case passed in 9.286s. Executor Linux x64, c-8 lon1, lifetime 123s, cost $0.0085. Log A-3951: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3951-suite-face52c0-685a-40ff-b087-d861caf86c6e-auto-at-27b5325.log. Combined with A-3947 Mac 10/10 serial whole-file proof and typecheck exit 0, all requested evidence is present. Awaiting Reviewer's final same-head verdict; claim retained.

### rev-31 · 2026-10-16T16:02:22.191Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-555-final
commit: 27b5325f80c231412983a72e314ba8840f44e859
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards 0 findings, Spec 0 findings. A-3955 records independent evidence inspection. A-3947 has ten serial Mac whole-file passes, each 7/7 (70/70 total), every exit zero. Post-review same-head Linux face52c0/A-3951 is exit0: selected hub29/29 including all seven suite-timeouts cases (changed case9.286s), Neovim smoke12/12, total41/41 with zero failures/skips. The reviewed source is unchanged and origin branch matches. C2 verified; C1 retains source verification rev-20261016-555-source. No exception or further run required.

Criteria: C2 verified.

### coord · 2026-10-16T16:02:49.786Z

Merged b3b2de9b841c9fbb31ca3faa12c7f2b90b2ccaae onto dev.
