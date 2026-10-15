---
id: T-514
kind: task
title: "heartbeat test: missed-heartbeat-after-restart case asserts a wall-clock delta of at least 950 ms that load breaks (Mac)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by:
  - T-508
regression_of: T-454
topic: null
branch: null
created: 2026-10-15T16:40:31.606Z
updated: 2026-10-15T17:38:11.431Z
---

## Problem

`hub/test/heartbeat.test.ts:106`, 'a missed heartbeat survives hub restart and fires once rather than replaying missed intervals', failed on the Mac under load in T-485's verify 34841ef7 (A-3169): the assertion that the timestamp delta is at least 950 ms was false. The case measures wall-clock spacing across a hub restart, which load can compress or stretch. It's T-454's test, so it's rework of T-454. The same file also has T-506 (stale-observation aging) and T-508 (run-digest teardown).

## Acceptance criteria

- [ ] C1. The case proves "fires once, no replay" with an injected or controlled clock and observed heartbeat events, rather than a wall-clock delta, and keeps the at-most-once assertion. The root cause is recorded in the commit.
- [ ] C2. heartbeat.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify. Coordinate with T-506 and T-508, which touch the same file: whichever lands second picks the first.
