---
id: T-2090
kind: task
title: test-lint-worker.test.ts's inner synthetic owner uses the supervisor's real TestContext signal, so outer cancellation can start inner cleanup while the proof and repair tail is still active
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-24T14:23:27.173Z
updated: 2026-11-24T14:23:27.173Z
---

## Summary

Review-loop-cap follow-up from T-2084's source review (rev-35, 7383cf0c); hygiene only, and it doesn't reopen T-2084's source-cleared head. At hub/test/test-lint-worker.test.ts:41 the inner synthetic owner is driven by the supervisor's real TestContext signal. An outer cancellation can therefore begin the inner cleanup while the proof and repair tail is still running.

## What to build

Isolate the synthetic cancellation boundary under the supervisor, so inner cleanup starts only once the proof and repair tail has settled, and add an interrupted-proof control.

## Acceptance criteria

- [ ] C1. An outer cancellation during the proof tail leaves inner cleanup waiting until the tail settles; an interrupted-proof control shows it (test, red before).
