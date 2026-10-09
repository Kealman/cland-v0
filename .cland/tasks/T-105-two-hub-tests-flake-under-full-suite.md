---
id: T-105
kind: task
title: "Two hub tests flake under full-suite load: the deleted-project doctor sweep lock (ENOENT) and the process-row rename publication timeout"
state: open
labels:
  - needs-triage
  - hub
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T20:43:35.328Z
updated: 2026-10-09T20:43:35.328Z
---

## Parent

Part of T-19. Seen in T-104's full suite on ed722e0 on 2026-10-09 at 20:41Z (A-187). Both tests pass 3 of 3 alone on ed722e0 and on dev at 7e5f959 (A-188), so they are pre-existing and load-dependent, not caused by T-104.

## What happened

1. The doctor deleted-project shutdown test failed with ENOENT, from creating the startup orphan-sweep lock folder after the project was deleted. T-76 handles ENOENT only when the project root is confirmed gone. The likely gap: the root still exists while deletion is in progress, but `.cland` or `.cland/run` is already gone. In that case the sweep reports a failure instead of skipping. Under load, the window between the root check and the deletion is wider.
2. The process-row publication test timed out after 5000 ms waiting for a frame. The launch with role qa was published, but the expected later rename event never arrived within the deadline.

## What to build

- Doctor: treat ENOENT from the sweep lock as "project removed" when `.cland` itself is gone or going, not only when the root is gone. Reproduce it deterministically by deleting `.cland` between the lock's stat and its mkdir.
- Process rows: find out whether the rename publication is lost or only late under load. If it is lost, that is a product bug: fix it, and test it with a deferred step. If it is only late, make the test wait on the event, never on a longer timeout.

## Acceptance criteria

- [ ] Each case is reproduced deterministically, then fixed.
- [ ] Both tests pass in 5 consecutive full suites under load, or the cause is shown to be outside the product.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S to M; triage first. Related: T-76 (the sweep lock), T-102 (machine-wide doctor overlap).
