---
id: T-1451
kind: task
title: A claude-code-schedule T2 case spawns a real process probe through doctor's identity check
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1471
topic: null
branch: null
created: 2026-10-29T19:10:59.188Z
updated: 2026-10-30T14:41:01.376Z
---

## Summary

The T2 case "Claude discovery misses retain liveness without accepting a conflicting native or process identity" in `hub/test/claude-code-schedule.test.ts` reaches `child_process.spawn` through doctor's identity check. A T2 case should not probe real processes; the fixture should supply its liveness observer.

## Evidence

Found aside by impl-1087 while instrumenting the file for T-1087 (2026-10-29):

```
doctor/report.ts:93 → processIdentitiesAsync → processAlive → claude-code.ts:824 → child_process.spawn
```

This path is outside FrameClient ownership accounting, which T-1087 fixes; T-1087 removes only the synchronous FrameClient `ps` probes.

## Acceptance criteria

- [ ] C1. The case runs with an injected liveness/identity observer and spawns no child process; an instrumented spawn guard in the test proves zero spawns, with assertions unchanged.
- [ ] C2. One native-default control still proves the production path probes a real pid.
