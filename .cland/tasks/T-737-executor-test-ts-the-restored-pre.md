---
id: T-737
kind: task
title: "executor.test.ts: the restored pre-executor job case reads job.pid before the launched worker reports it (load)"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T14:18:58.698Z
updated: 2026-10-17T14:18:58.698Z
---

## Summary

`hub/test/executor.test.ts::a pre-executor running job restored from hub.db reports as local exactly once` failed in integrated cover 3fed9129 (A-4528) and earlier on T-689's branch (A-4259, 2026-10-17 00:27Z) at `assert.ok(job.pid)`, right after `f.launch()`. It passes 10/10 alone on the Mac. Under load the launch returns before the worker's pid is recorded.

## What to build

Make the fixture's launch wait for the hub's own "running with pid" receipt (status or journal) before returning, or have the case wait for it, instead of asserting on the first launch reply. Keep every later assertion: stop, the hub.db rewrite to a pre-executor row, the restore and the single local report.

## Acceptance criteria

- [ ] C1. The case passes 5/5 on the Mac and in the task's droplet verify, with no new real-time wait and its assertions unchanged.
