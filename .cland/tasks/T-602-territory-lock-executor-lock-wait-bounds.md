---
id: T-602
kind: task
title: territory-lock "executor lock wait bounds contention and names the lock and elapsed wait" passes 4/5 under the load gate on a droplet
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:30:28.875Z
updated: 2026-10-16T11:30:28.875Z
---

## Summary

In T-588's droplet verify 84d72d8f (A-3888, Linux c-8, at eb00ccc5), T-471's load gate repeated hub/test/territory-lock.test.ts "executor lock wait bounds contention and names the lock and elapsed wait" (T-491's test) and it passed 4 of 5. It was new to the manifest then. The durations refresh 60517392 made it a known entry, so the load gate no longer repeats it, but the 1-in-5 failure under parallel load is real.

## Acceptance criteria

- [ ] C1. The test passes 10/10 under the load gate's parallel repetition on a droplet, or its bound is widened with a reason that names the contention it measures.
