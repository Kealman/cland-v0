---
id: T-555
kind: task
title: "suite-timeouts test: 'one cleanup warning' not seen within 15000 ms under load (Mac)"
state: open
status: in progress
size: XS
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
topic: topic-381
branch: t/T-555-suite-timeouts-test-one-cleanup-warning
created: 2026-10-16T01:06:48.258Z
updated: 2026-10-16T15:51:07.751Z
---

## Summary
In T-533's local verify bbfee74e at 77659eb0 (2026-10-16 ~01:05Z, Mac, peak load about 15–20; log A-3523), `hub/test/suite-timeouts.test.ts:179` failed with "one cleanup warning: not within 15000 ms". T-533 doesn't touch the file. No E-482 ticket names this case yet.

## Acceptance criteria
- [ ] C1. The case waits on the cleanup warning's own receipt, not a fixed 15 s window shared with slow teardown, or records why 15 s is the contract. The root cause goes in the commit, and every assertion stays.
- [ ] C2. suite-timeouts.test.ts passes 5/5 serially as a whole file on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-555 · 2026-10-16T15:49:58.224Z

Diagnosis: the 15s `one cleanup warning` wait begins at the child PID marker, before the 3s silence watchdog, verified process termination, compatibility lease cleanup, durable worker result.json and hub reconciliation. There is no 15s end-to-end warning contract. Baseline whole file passed 7/7 in 34.95s (Mac). A temporary 16s pre-receipt delay restricted to cleanup-incomplete outcomes reproduced exactly `one cleanup warning: not within 15000 ms` (exit 1, 17.63s). Minimal fix observes the worker's result.json with a separate bounded 30s condition before the original warning receipt wait; every existing assertion remains. Testing the same delayed outcome next; temporary worker instrumentation will be removed.

### impl-555 · 2026-10-16T15:51:07.751Z

Committed 27b5325f80c231412983a72e314ba8840f44e859 after fetching/merging origin/dev (af78bc39). Root cause is recorded in the commit. Four added test lines only; every existing assertion and warning timeout stays. The identical 16s pre-receipt delay that failed the old test passes fixed (1/1, exit 0, 25.69s), and temporary worker probe is removed. Diagnosis evidence A-3931: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3931-t-555-diagnosis-and-deterministic-delay-probe.md. `npm run typecheck` at this head: exit 0. Whole-file Mac 10-run serial proof is underway. No new/renamed test, so no new duration allowance is needed.
