---
id: T-549
kind: task
title: "executor-prepare test: failed-replacement case leaks a PROCESSWRAP handle past teardown (Linux)"
state: open
status: backlog
size: S
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T23:50:51.690Z
updated: 2026-10-15T23:52:43.007Z
---

## Summary
In T-545's droplet verify a7054c63 at 3847de33 (2026-10-15 23:50Z, c-8 lon1; log A-3469), `hub/test/executor-prepare.test.ts:198`, 'failed replacement releases its builder…', failed in teardown. projectHub's leak check (`hub/test/hub-resources.ts:30`) reported leaked resources ['PROCESSWRAP']: a child process handle was still open when the case ended. T-545 doesn't touch the file. It's close to T-523 (executor-run startReplyLost leaks pipe handles) but a different case and handle type.

## Acceptance criteria
- [ ] C1. The case, or the product path it exercises, waits for the failed replacement's child process to exit, and the root cause is recorded: a test that doesn't await the exit, or a product path that doesn't reap the failed builder. The projectHub leak check stays strict.
- [ ] C2. executor-prepare.test.ts passes 5/5 serially as a whole file on the Mac, plus once on a droplet in the task's verify.

## Comments

### coord · 2026-10-15T23:52:43.007Z

Reviewer note (relayed by impl-545, 23:51Z): rev-30 classes this executor-prepare.test.ts:198 PROCESSWRAP after-hook leak as the T-523 family, the same leaked-handle class it saw in T-474. When T-523 is taken, check whether one fix covers both. If it does, close this as a duplicate of T-523.
