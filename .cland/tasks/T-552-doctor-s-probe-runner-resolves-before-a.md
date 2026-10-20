---
id: T-552
kind: task
title: doctor's probe runner resolves before a timed-out child's close event
state: open
status: review
size: S
criterion_seq: 2
labels:
  - hub
  - tech-debt
assignee: null
parent: E-952
blocked_by: []
topic: topic-715
branch: t/T-552-doctor-s-probe-runner-resolves-before-a
created: 2026-10-16T00:33:56.971Z
updated: 2026-10-20T09:47:34.134Z
---

## Summary
Found aside by impl-523 on T-523 (2026-10-16 00:31Z, code reading, not yet reproduced as a failure). In `hub/src/doctor/report.ts:94–103`, `run()` kills a timed-out probe's process group, destroys its pipes, then resolves at once, without awaiting the ChildProcess `close` event. Its error handler also resolves before close. `processStartedAsync` uses this helper, so a probe timeout can leave native process resources alive briefly after the promise settles. That's the same class as T-523's watchdog stop, which T-523 keeps out of scope.

## Acceptance criteria
- [x] C1. `run()` resolves on timeout or error only after the child's `close` (bounded, with SIGKILL escalation), and callers' timeouts still hold.
  - done: impl-552 · 2026-10-20T09:47:32.460Z
- [x] C2. A test times out a probe whose child ignores SIGTERM and shows that no PROCESSWRAP or PIPEWRAP handle remains once the promise settles.
  - done: impl-552 · 2026-10-20T09:47:33.130Z

## Comments

### impl-552 · 2026-10-20T09:43:14.371Z

A-7125 triage confirmed: REAL-CREW/S row still applies. Reproduced exported run() timeout at current head: after await run(node, SIGTERM-ignoring script, env, 200), native PROCESSWRAP and PIPEWRAP resources still report hasRef() true. Regression will observe only probe-owned native resources and assert they are closed at promise settlement, without a post-settlement wait.

### impl-552 · 2026-10-20T09:46:44.411Z

Implemented: deadline/error records are retained until ChildProcess close; settlement then crosses a full event-loop turn so libuv native close callbacks also finish. Synchronous spawn exceptions can allocate native handles before throwing, so they share that drain. Existing group SIGKILL deadline is retained. Three lifecycle regressions cover timeout with SIGTERM ignored, asynchronous ENOENT, synchronous ENOTDIR; all assert zero probe-owned open PROCESSWRAP/PIPEWRAP handles at settlement. Red/green observed. Full doctor-cli.test.ts passes 9 tests; root typecheck passes. Fetched/merged origin/dev (tracker-only fast-forward 2bfa813b); QA policy is none.
