---
id: T-1235
kind: task
title: A rename during native resume can strand the launch reservation under the old name
state: open
status: backlog
size: S
labels:
  - bug
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-24T11:19:13.427Z
updated: 2026-10-24T11:19:13.427Z
---

## Summary

A native session resume records its launch reservation under the admitted session name. The settlement then uses the current name: `#resume` calls `releaseLaunchRole(row().name, …)` on failure and `launchSettled(process.name)` on success. Store reservations are keyed by name and do not follow a rename, so a Coordinator rename during a native resume can strand the original reservation key. impl-1220 found this statically during the T-1220 M4 audit; it is not yet reproduced.

## Acceptance criteria

- [ ] C1. A rename during a native resume releases or settles the reservation recorded under the admitted name, on both failure and success (test).
- [ ] C2. No reservation key outlives its resume after a rename (test).
