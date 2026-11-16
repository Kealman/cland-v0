---
id: T-1916
kind: task
title: "A remote run still marked running whose droplet no longer exists keeps its remote slot after T-1843 (ghost b33e7940 survived restart #77)"
state: open
status: backlog
size: S
labels: []
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1843
topic: null
branch: null
created: 2026-11-16T16:07:55.388Z
updated: 2026-11-16T16:07:55.388Z
---

## Summary

After T-1843 landed (b57847bca) and the hub restarted on it (#77, 2026-11-16 16:05Z), `cland verify queue` still lists run b33e7940 (occasion dev-t3, since 2026-11-12T23:02Z, droplet cland-v0-58c69f29 lon1) as a remote run holding one of the 8 slots. `cland executor status` shows only two tagged droplets, neither of them cland-v0-58c69f29, so its machine is gone. T-1843 reconciles a run whose record is finished and whose lease is gone, and posts a result for one that ended without one. This run's record is apparently still running with no machine, a case neither criterion covered.

## What to build

At hub start and on each remote reconciliation, treat a remote run whose record is still running but whose droplet no longer exists at the provider (confirmed by a read, as for deletions) as ended. Release its slot and post exactly one result naming the missing machine, as T-1843 does for its cases.

## Acceptance criteria

- [ ] C1. A persisted remote run in the running state, whose droplet the fake provider no longer lists, is absent from `verify queue` and frees its slot after a hub start (test, red before the fix).
- [ ] C2. It gets exactly one posted result naming the missing machine, and a run whose droplet still exists keeps its slot (test).
