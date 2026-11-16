---
id: T-1688
kind: task
title: Host agent treats /proc ENOENT as exit; a hidepid or foreign-namespace /proc can make a live process read as exited
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1684
topic: null
branch: null
created: 2026-11-05T11:59:40.426Z
updated: 2026-11-16T07:29:11.162Z
---

## Summary

T-1684 made the host agent's native observation (`hub/src/host/agent/native.ts`) treat ENOENT on `/proc/<pid>/stat` as positive proof that the process exited. On a host whose `/proc` is mounted with `hidepid=1/2`, inside some containers, or across a PID namespace, a live process of another user or namespace can read as ENOENT. The agent could then settle a live process as exited: it would skip a stop, release a generation, or delete its private files. Hub-local identity deliberately keeps ENOENT unknown and falls back to `kill(0)` (coord decision on T-1687, 2026-11-05). Reported by impl-1687.

## What to build

Decide the agent's ENOENT policy for restricted `/proc` mounts. Options:
- detect `hidepid` or a foreign namespace at agent start and refuse positive-ENOENT there, falling back to `kill(0)` with the existing birth check;
- or keep positive-ENOENT only for PIDs the agent itself spawned and still parents.

Never let observation grant signal or deletion authority.

## Acceptance criteria

- [ ] C1. With `/proc` behaving as hidepid for a live child, the agent never reports it exited and never deletes its files (test, simulated mount).
- [ ] C2. On an ordinary `/proc`, T-1684's exit-race behaviour is unchanged (test).
