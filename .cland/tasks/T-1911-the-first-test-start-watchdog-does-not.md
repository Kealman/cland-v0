---
id: T-1911
kind: task
title: The first-test-start watchdog does not cover load-gate repetitions and Web repetition children
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1841
topic: null
branch: null
created: 2026-11-16T13:42:11.941Z
updated: 2026-11-16T13:42:16.760Z
---

## Summary

T-1841's shared first-test-start watchdog guards the tier commands on the local `suiteCommand` path and the droplet `run-suite.ts` path. The reviewer found, at 6d7668f8 (topic-1546), that load-gate repetition children (stdout inherited) and the separate Web repetition emitter are outside it, so a repeated file that never starts its first test still waits for the no-output guard. Split from T-1841 under the review-loop cap.

## What to build

Route repetition progress through the same shared watchdog: one guard per repetition child, with its own native cleanup owner. The outer marker ownership stays bounded to the guarded lifetimes, as T-1841 sets it.

## Acceptance criteria

- [ ] C1. A load-gate repetition child that starts a file but never starts its first test is stopped within the named startup bound, with the shared stall evidence (test, red before the fix).
- [ ] C2. A Web repetition that never starts its first test is stopped the same way, and a normal repetition run is unaffected (test).
