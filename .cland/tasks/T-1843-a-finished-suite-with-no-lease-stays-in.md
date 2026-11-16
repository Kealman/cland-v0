---
id: T-1843
kind: task
title: A finished suite with no lease stays in verify queue as an active remote run and holds a remote slot across restarts
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-13T12:41:29.355Z
updated: 2026-11-16T07:29:04.494Z
---

## Summary

Periodic dev-t3 run b33e7940-f94b-4916-9181-13c0dec731f7 (started 2026-11-12 23:02:11Z on droplet cland-v0-58c69f29, lon1) ended without a posted result. Since then `cland verify queue` keeps listing it as an active remote run ("remote n/8 … ETA 0s") and counting it against the remote budget, across hub restart #71. `cland verify cancel` refuses it with "suite already finished", and the droplet no longer exists (executor status tags only the live lease). So a finished suite holds a remote slot that no permitted action clears.

## What to build

A suite that has finished, or whose lease and droplet are gone, leaves the active remote list and releases its slot. That holds at hub start too, where a restored run record with no live lease and a finished state is reconciled as finished instead of active. A run that ended without a posted result still gets one posted result naming why (lost collection, missing receipt), and the heartbeat's "ended without a posted result" row clears once that result is posted.

## Acceptance criteria

- [ ] C1. A remote run whose suite record is finished and whose lease is gone is absent from `cland verify queue` and does not count against `remote_budget`, both live and after a hub restart (test).
- [ ] C2. A run that ended without a posted result gets exactly one posted result naming the missing receipt, after which the heartbeat no longer lists it (test).
