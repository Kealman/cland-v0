---
id: T-1152
kind: task
title: Hub start spends 16 s silent between binding listeners and restoring sessions when a lease needs recovery
state: open
status: backlog
size: S
labels:
  - bug
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-22T18:04:51.408Z
updated: 2026-10-22T19:37:18.796Z
---

## Summary

At hub restart #46 the new hub logged "binding listeners" at 18:02:28.83Z and "restoring sessions" at 18:02:44.89Z, a 16 s gap. Only one explorer recompute, one archive sweep and one claude-schedule event fell in it, so this is not the T-1104 storm. The first executor events after serving were executor-reconcile-failed "lease recovery deferred" (18:03:01.99Z) and executor-sweep leases 1 / failures 1 (18:03:05Z). The suspect is synchronous recovery of the lease orphaned by T-1151's stop, a provider call before sessions are restored. With the stop's 26 s, the mod bridge gap reached 46.7 s of its 60 s grace.

## What to build

Startup restores sessions without waiting on executor lease recovery or any provider call. Recovery runs after serving, and the startup steps log their durations so a gap names its cause.

## Acceptance criteria

- [ ] C1. A hub start with a recorded lease whose provider calls hang reaches "restoring sessions" and serving within 2 s of listening, and recovery completes or defers afterwards (test).
- [ ] C2. Each startup step between listening and serving logs its duration (test).
