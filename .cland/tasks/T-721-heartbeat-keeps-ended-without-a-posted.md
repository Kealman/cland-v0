---
id: T-721
kind: task
title: Heartbeat keeps 'ended without a posted result' rows for runs whose items have closed
state: open
status: backlog
size: XS
labels:
  - bug
  - hub
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T20:27:15.756Z
updated: 2026-10-16T20:27:15.756Z
---

## Summary

The Coordinator's heartbeat lists six "ended without a posted result" runs, 8 to 19 hours old: 97a70087, de3df9c9, 3df8e38c, 4cff14eb, 85b2c03a and f2baa6f7. Every one belongs to an item that has since closed (T-550, T-556, T-505, T-559, T-517, T-604), and the rows survived the 20:12Z hub restart. A stale row the Coordinator can't act on hides the ones it can.

## What to build

A run without a posted result leaves the heartbeat's Stale section when its item closes, or when a later run of the same item posts a result. It stays in the run history. A stale row for an open item keeps showing as today.

## Acceptance criteria

- [ ] C1. A run that ended without a posted result drops from the heartbeat's Stale section once its item closes or a later run of that item posts a result, and stays listed for an open item with no later result, proved by a heartbeat test on a fake clock.
- [ ] C2. The run's own record and its history entry are unchanged, proved by the same test.
