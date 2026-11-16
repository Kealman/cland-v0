---
id: T-1878
kind: task
title: "Soak run's deadline plan leaves no room for Web: d5150de3 timed out (exit 124) in the Web tier after T0–T4 passed"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-16T04:19:13.815Z
updated: 2026-11-16T04:19:13.815Z
---

## Summary

The hub's soak run d5150de3 at dev 92dd61bcf (2026-11-16, droplet c-8 ams3, A-19799) ended with exit 124: `timeout: 8328 tests completed, 0 failed`. Four Web files were in flight (events, item-card, inbox, hosts-view), so Web was not executed to the end. T0 to T4 had exited 0. The soak deadline plan printed `projected 3539.0 s <= 3540.0 s (20% margin + 60 s overhead)`. That projection appears to leave about 1 s of headroom, and T3 alone observed 2877 s against its projection, so the plan didn't hold under the run's real durations.

## What to build

Find out why the soak's deadline plan admitted a selection that reached the deadline. Check whether Web's projected wall is in the plan, and why a projection 1 s under the limit counts as fitting. Then fix it: either the plan keeps enough margin for every tier it selects, or the soak trims its repetitions to fit. A soak that times out reports which tiers were unexecuted as such.

## Acceptance criteria

- [ ] C1. With the recorded durations of A-19799, the soak plan either fits all selected tiers with real margin or trims repetitions, shown by a test over a fake duration manifest (test).
- [ ] C2. A soak that times out names its unexecuted tiers and files in the result, as unexecuted, never as passed (test).
