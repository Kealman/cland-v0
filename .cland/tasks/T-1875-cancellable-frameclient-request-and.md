---
id: T-1875
kind: task
title: Cancellable FrameClient request and waitFor in the shared test client, so card-web's inner receipts can use the load-scaled waits
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
created: 2026-11-15T19:47:41.913Z
updated: 2026-11-15T19:47:41.913Z
---

## Summary

The shared FrameClient test API's `request` and `waitFor` can't be cancelled. So the Telegram card-web fixture's inner `web.link`, request and welcome waits keep a fixed real 1 s bound: making them longer would leave uncancellable timers running past the fixture's 2 s drain. This came out of T-1874's source review on 2026-11-15. T-1874 kept those 1 s bounds and moved only the outer setup observer to the shared load-scaled wait.

## What to build

Give FrameClient's `request` and `waitFor` an AbortSignal, or another cancellable owner, that the fixture's teardown can end. Then move card-web's inner prerequisite receipts onto the shared load-scaled waits with a named reason. Sweep FrameClient's other callers for the same fixed real bounds. Keep the helper's existing contract compatible for callers that pass no signal.

## Acceptance criteria

- [ ] C1. FrameClient request and waitFor accept cancellation, and teardown ends every pending timer, shown by a test that fails on the uncancellable version (test).
- [ ] C2. card-web's inner receipts use the shared load-scaled wait, and the card-web tests pass 20 out of 20 runs at a 1-minute load of at least 8 with unchanged assertions (test).
