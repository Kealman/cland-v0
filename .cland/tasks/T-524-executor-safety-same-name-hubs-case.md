---
id: T-524
kind: task
title: "executor-safety same-name hubs case: remote result not seen within 20 s under load (Linux)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-430
topic: null
branch: null
created: 2026-10-15T19:26:17.820Z
updated: 2026-10-15T19:26:17.820Z
---

## Problem

`hub/test/executor-safety.test.ts:206`, 'same-name hubs preserve each other's in-flight keys and conservatively age legacy keys', timed out on Linux in T-474's droplet verify c7535028 (A-3294). The failure was `eventually('remote result')` not within 20000 ms. The case took 103 s at a peak load of 15.8. T-430 fixed this case's same-name-key race earlier, so this is a recurrence under load, with the 20 s remote-result wait too short or racing.

## Acceptance criteria

- [ ] C1. The case waits for the remote result on an observed boundary, such as the run's done receipt, before starting its result window, in the style of T-490. Alternatively, the window is aligned with the product deadline it covers, citing the line. Every other assertion stays, and the root cause is recorded in the commit.
- [ ] C2. executor-safety.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
