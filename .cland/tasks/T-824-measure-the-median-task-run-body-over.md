---
id: T-824
kind: task
title: Measure the median task-run body over the first 20 droplet task runs after T-713
state: open
status: backlog
size: XS
labels:
  - ready-for-human
assignee: null
parent: E-678
blocked_by:
  - T-713
topic: null
branch: null
created: 2026-10-19T01:56:44.318Z
updated: 2026-10-19T01:56:49.257Z
---

## Summary

The post-merge measurement split from T-713's C5: after T-713 lands, the median task-run body (check through collection) over the first 20 droplet task runs must be 8 minutes or less on c-8 at workers 2. It's measured from live run results, so it can only be verified after T-713 merges and a hub restart puts it live.

## Acceptance criteria

- [ ] C1. Over the first 20 droplet task runs after T-713 is live, the median task-run body (check through collection) is 8 minutes or less on c-8 at workers 2; the run ids, per-run bodies and the median are recorded on this item.
