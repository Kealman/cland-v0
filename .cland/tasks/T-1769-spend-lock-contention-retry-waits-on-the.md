---
id: T-1769
kind: task
title: Spend lock contention retry waits on the hub FakeClock, so T2 projectHub fixtures deadlock
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: null
branch: null
created: 2026-11-09T07:45:15.143Z
updated: 2026-11-16T07:31:08.464Z
---

## Summary

The spend ledger lock's contention retry (`acquireLockWithRetry`, a 25 ms wait) runs on the clock it is given. In a `projectHub` T2 fixture that is the hub's FakeClock. A transaction that meets contention, for example with the startup `DropletExecutor.sweep`, never retries unless the test advances the clock. The test then hangs, and teardown waits on the held create. It showed on Linux in T-1751's load-gate repetition (verify 36772956, A-18003); macOS ordering hid it. T-1751 works around it with a fixture barrier on the startup sweep's completion.

## Acceptance criteria

- [ ] C1. Lock contention retry in tests doesn't depend on the test advancing a FakeClock: the backoff uses a real timer, or the fixture lock carries its own clock (test).
- [ ] C2. A T2 `projectHub` case with startup-sweep contention completes without an explicit barrier on Linux and macOS (test).
