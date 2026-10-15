---
id: T-481
kind: task
title: executor-prepare test reads the executor-lease-released record before the journal publishes it (Linux)
state: open
status: planned
size: XS
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-432
topic: null
branch: null
created: 2026-10-15T09:14:01.095Z
updated: 2026-10-15T09:14:35.403Z
---

## Summary

`hub/test/executor-prepare.test.ts:165` ('prepare keeps its snapshot when builder deletion is unconfirmed, then the hub confirms release and cost') read `released.lifetimeMs` after the leases reached zero, but the `executor-lease-released` journal record was still undefined. This was a TypeError in T-461's Linux droplet run 2bef23b0 (A-2810), 2026-10-15. T-432 fixed this case's 422 and unconfirmed staging. What remains is ordering: zero leases is observed before the release record is flushed. Wait for the release record itself, after the journal's flushLogs barrier.

## Acceptance criteria

- [ ] C1. The case waits for the published `executor-lease-released` record, with no read before it, and passes 5/5 beside a full run, with one droplet run green.
