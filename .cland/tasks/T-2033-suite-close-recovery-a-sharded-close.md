---
id: T-2033
kind: task
title: suite-close-recovery 'a sharded close handles restart with one result and confirmed cleanup' waits over 30 s for the remote group start under macOS T3 load (passes 5/5 alone)
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
created: 2026-11-20T15:30:56.396Z
updated: 2026-11-20T15:30:56.396Z
---

## Summary

The macOS stage cover a370feaa at dev fb3d9f03 (log A-22174) failed at T3 on one test: `hub/test/suite-close-recovery.test.ts::a sharded close handles restart with one result and confirmed cleanup` gave up with "remote group started: not within 30000 ms" at 34.7 s, peak load 7.6. It passed 5/5 alone right after on the same machine (8–12 s), in the earlier macOS cover A-22117 (15.1 s), and in both Linux covers today (13.1 s, 13.7 s).

## What to build

Find what "remote group started" waits for in this case and why it can take over 30 s under macOS T3 load (a real timer, a polling interval, or work that scales with load). Make the wait event-driven or bound it by what it actually does, keeping the assertions.

## Acceptance criteria

- [ ] C1. The waiting point is named from evidence, and the case no longer depends on a 30 s real-time wait for the remote group start (test).
- [ ] C2. The case passes 5/5 under the two-worker load gate on macOS (test).
