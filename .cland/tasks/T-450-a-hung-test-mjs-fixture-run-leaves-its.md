---
id: T-450
kind: task
title: A hung.test.mjs fixture run leaves its runner and child alive for hours (orphan from the hung-run tests)
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
regression_of: T-385
topic: topic-1060
branch: t/T-450-a-hung-test-mjs-fixture-run-leaves-its
created: 2026-10-15T03:49:38.455Z
updated: 2026-10-25T17:20:03.695Z
---

## Summary

impl-397 found two orphan node processes, about 15 h old (PID 48761 under PPID 1, and its child 48920), at 0% CPU. They were running `hung.test.mjs` from the suite directory `/private/tmp/cland-suite-cb5d74ec-…`. They are the leftover of T-385's hung-run test fixture from a run on 2026-10-14 about 12:25Z, which survived both its suite and the phase orphan sweep. The Coordinator terminated them on 2026-10-15 03:50Z, after checking the command lines. The hung-run tests must reap their own hung child even when the run times out, and the phase sweep should catch such a runner.

## Acceptance criteria

- [ ] C1. A test that starts a hung fixture run kills its runner and children on every exit path, and the file passes 5/5 with no node process left afterwards.
- [x] C2. The runner's phase sweep reports a leaked hung fixture runner, proven by a test that leaks one on purpose.
  - done: impl-450 · 2026-10-25T17:20:03.695Z

## Comments

### impl-450 · 2026-10-25T17:09:26.585Z

Clean inherited worktree. TDD seams authorized by launch brief: T3 real hung run ownership/OS PID termination (C1), runner phase sweep output + OS PID termination for an intentionally leaked hung node:test runner (C2). No product wire/schema/admission contract change planned. Read A-11669 row T-450; current hung case has neither PID ownership nor post-run death assertions. Parent E-1282 has after-stage QA scope none; no per-item brief.

### impl-450 · 2026-10-25T17:18:51.215Z

C1 red: both sealed fault controls initially failed on macOS/local with `hung fixture PID 92741 survived setup failure` / `hung fixture PID 93911 survived assertion failure`. Fixed by registering verifier-owned cancellation/terminal receipt before fixture socket disposal, plus live PID ownership and final OS death assertions. C2: added intentionally leaked detached node --test hung runner+worker regression; current sweep already handles it. Negative control temporarily omitting completed-phase sweep failed `/cleanup pid 12217:.*hung.test.mjs/`; restoring it passes (~0.6s macOS). No run-suite.ts product change; no command/help/permission or wire consumers to migrate. Updated per-file docs, index and implement skill/CHANGES; role clause unchanged at its byte reserve.
