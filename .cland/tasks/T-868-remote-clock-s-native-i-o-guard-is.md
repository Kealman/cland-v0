---
id: T-868
kind: task
title: "remote-clock's native-I/O guard is inactive: scripted machines never call remoteWaits.track()"
state: open
status: backlog
size: S
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-19T11:41:10.800Z
updated: 2026-10-19T14:49:53.375Z
---

## Summary

`hub/test/remote-clock.ts` exposes `remoteWaits.track()` and guards clock advancement with `active.size`. But the current scripted-machine and remote-fixture code never calls `track`, so the native-I/O guard never engages. Independent peer drivers also lack a joint I/O boundary.

## Evidence

Found aside by impl-524 on 2026-10-19 while fixing T-524. T-524 now avoids these drivers during same-name readiness and completion.

## Acceptance criteria

- [ ] C1. Either scripted machines and the remote fixture register their native operations with the clock guard, or the guard is replaced by an enforceable shared receipt API. A held-I/O regression shows that advancing the clock while a tracked operation is in flight is refused or joined.
