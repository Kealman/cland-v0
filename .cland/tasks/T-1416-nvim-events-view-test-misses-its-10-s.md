---
id: T-1416
kind: task
title: nvim events view test misses its 10 s first-page wait once under a loaded task run
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-28T00:02:27.244Z
updated: 2026-10-29T15:58:58.640Z
---

## Summary

`nvim/test/events.test.ts::Events view opens through the registry, groups days, pages, folds and follows live rows without losing selection` failed once in T-1383's mode-free run 78bce2b0 (Linux droplet c-8 lon1, head 88135628, log A-12965): `Error: the screen never showed events first page within 10000 ms` at line 33 (10.69 s). The test is unchanged and outside T-1383. Alone it passed 5/5 on dev e7297a5e (macOS, Node 24.21.0); it passed in every other recent run.

## What to build

Find why the first events page can take over 10 s to render under load (a hub reply waiting behind other work, a render wait that polls the screen instead of a state receipt, or a slow fixture) and make the wait observe the page's own render receipt, bounded for a loaded runner, without hiding a real stall.

## Acceptance criteria

- [ ] C1. The cause is attributed with the failing run's output and a reproduction under CPU load.
- [ ] C2. The identity passes 10/10 at two workers plus owned CPU load.
