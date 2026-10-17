---
id: T-759
kind: task
title: claude-code-schedule.test.ts claims no native processes but its known-PID resume spawns ps through processStartedAsync
state: open
status: backlog
size: XS
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-17T22:05:24.636Z
updated: 2026-10-17T22:05:24.636Z
---

## Summary

Found by impl-750 on 2026-10-17 at 22:04Z, under T-750's enforced tripwire. claude-code-schedule.test.ts mocks child_process.execFile and claims to start no native processes. However, its known-PID adapter resume calls processStartedAsync → doctor.run → spawn(ps), so an enforce pass trips and stalls. Raw runs pass 5/5, with a median of 1.33 s.

## What to build

Inject the process-start fact into the adapter resume path that this test exercises, as T-750 and T-751 do for their files. Production keeps the native reader. Keep every assertion.

## Acceptance criteria

- [ ] C1. claude-code-schedule.test.ts passes 5/5 under the enforced runtime tripwire with no child_process trip, with its assertions unchanged.
