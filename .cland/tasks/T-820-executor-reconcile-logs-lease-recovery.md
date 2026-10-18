---
id: T-820
kind: task
title: Executor reconcile logs 'lease recovery deferred' every 10 minutes on a healthy hub
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-18T20:24:17.977Z
updated: 2026-10-18T20:24:17.977Z
---

## Summary

Since restart #13 (2026-10-18 19:10Z), the serving hub has logged `executor-reconcile-failed: lease recovery deferred` every 10 minutes: 5 times in the first hour, and still going on pid 79176. No droplet is lost and spend is correct, but the recurring failure means some lease state can never be recovered or retired. T-813 fixed the lock leak and the CPU churn, not this.

## Acceptance criteria

- [ ] C1. The cause is named: the lease records the reconcile keeps deferring and why they can't complete. A regression test reproduces the repeating deferral from a matching ledger or lease state.
- [ ] C2. Reconcile either completes those leases or retires them with one journal line naming them; on an unchanged state it logs no further `lease recovery deferred` lines.
