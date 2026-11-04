---
id: T-1668
kind: task
title: Git daemon close throws 'termination incomplete' when a short-lived daemon exits before its identity is read
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
created: 2026-11-03T23:44:16.182Z
updated: 2026-11-03T23:44:16.182Z
---

## Summary

`hub/test/host-git-daemon.test.ts` "eight admitted daemons per host; excess is refused, logged and close joins native exits" failed in 0.12 s in batch 9d28e6dc (log A-16408, T-1604+T-1608, Linux c-8, peak load 9.6). It passed in 0.87 s in the preceding batch (A-16401), and neither batch member touches `git-daemon.ts`. In `hub/src/host/git-daemon.ts` (~line 72), stop throws 'Git daemon termination incomplete' when `native.identity` returned null and `close` has not fired yet. That is the case for a daemon that exits before its identity is read, so the process is already gone, not leaked.

## What to build

Stop waits for the child's own close, bounded, when no identity proof was captured. It treats a closed child as terminated, and reports incomplete only when the child is still alive with no provable identity.

## Acceptance criteria

- [ ] C1. A daemon that exits before its identity is read is joined by close without an error (test with a held identity read).
- [ ] C2. A daemon still running with no provable identity still reports termination incomplete, without signalling (test).
- [ ] C3. The eight-daemon case passes 20/20 under the load gate.
