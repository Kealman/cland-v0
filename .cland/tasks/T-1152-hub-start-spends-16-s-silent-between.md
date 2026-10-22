---
id: T-1152
kind: task
title: Hub start spends 16 s silent between binding listeners and restoring sessions when a lease needs recovery
state: open
status: review
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-865
branch: t/T-1152-hub-start-spends-16-s-silent-between
created: 2026-10-22T18:04:51.408Z
updated: 2026-10-22T19:44:29.418Z
---

## Summary

At hub restart #46 the new hub logged "binding listeners" at 18:02:28.83Z and "restoring sessions" at 18:02:44.89Z, a 16 s gap. Only one explorer recompute, one archive sweep and one claude-schedule event fell in it, so this is not the T-1104 storm. The first executor events after serving were executor-reconcile-failed "lease recovery deferred" (18:03:01.99Z) and executor-sweep leases 1 / failures 1 (18:03:05Z). The suspect is synchronous recovery of the lease orphaned by T-1151's stop, a provider call before sessions are restored. With the stop's 26 s, the mod bridge gap reached 46.7 s of its 60 s grace.

## What to build

Startup restores sessions without waiting on executor lease recovery or any provider call. Recovery runs after serving, and the startup steps log their durations so a gap names its cause.

## Acceptance criteria

- [x] C1. A hub start with a recorded lease whose provider calls hang reaches "restoring sessions" and serving within 2 s of listening, and recovery completes or defers afterwards (test).
  - done: impl-1152 · 2026-10-22T19:43:36.487Z
- [x] C2. Each startup step between listening and serving logs its duration (test).
  - done: impl-1152 · 2026-10-22T19:43:36.552Z

## Comments

### impl-1152 · 2026-10-22T19:41:51.324Z

TDD local Darwin/arm64 worktree evidence: the hanging scripted-provider fixture served on the baseline (7.171 ms listening→serving), so it does not reproduce the incident's 16 s delay. With recovery-admission diagnostics present, RED failed `recovery admission is logged after serving` against eager constructor admission. Deferred admission GREEN: startup-ready-component.test.ts 4/4. Second RED lacked named web-listener/discovery steps; GREEN adds monotonic completion durations, 5/5 targeted tests. No live hub/provider used. Full verification is pending exact-head source review.
